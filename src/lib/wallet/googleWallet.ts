import "server-only";

import { google } from 'googleapis';
import jwt from 'jsonwebtoken';
import * as fs from 'fs';
import * as path from 'path';

export interface WalletCredentials {
    client_email: string;
    private_key: string;
}

export interface LoyaltyClassResponse {
    id: string;
    success: boolean;
}

const SCOPES = ['https://www.googleapis.com/auth/wallet_object.issuer'];

/**
 * Ensures we can safely load the Google credentials JSON.
 * Prioritizes GOOGLE_WALLET_CLIENT_EMAIL / GOOGLE_CLIENT_EMAIL &
 * GOOGLE_WALLET_PRIVATE_KEY / GOOGLE_PRIVATE_KEY environment variables,
 * and falls back to google-service-account.json in the project root.
 */
function loadCredentials(): WalletCredentials {
    const envEmail = (process.env.GOOGLE_WALLET_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL)?.trim();
    const envPrivateKey = (process.env.GOOGLE_WALLET_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY)?.trim();

    if (envEmail && envPrivateKey) {
        return {
            client_email: envEmail,
            private_key: envPrivateKey.replace(/\\n/g, '\n').trim(),
        };
    }
    const credentialsPath = path.join(process.cwd(), 'google-service-account.json');
    if (!fs.existsSync(credentialsPath)) {
        throw new Error('Google Wallet credentials: no se encontraron credenciales en variables de entorno ni el archivo google-service-account.json.');
    }
    const fileContent = fs.readFileSync(credentialsPath, 'utf8');
    const parsed = JSON.parse(fileContent);
    if (!parsed.client_email || !parsed.private_key) {
        throw new Error('El archivo google-service-account.json no contiene client_email o private_key válidos.');
    }
    return {
        client_email: String(parsed.client_email).trim(),
        private_key: String(parsed.private_key).replace(/\\n/g, '\n').trim(),
    };
}

/**
 * Returns whether Google Wallet is configured on the server.
 */
export function googleWalletConfigured(): boolean {
    const issuerId = (process.env.GOOGLE_WALLET_ISSUER_ID || process.env.GOOGLE_ISSUER_ID)?.trim();
    if (!issuerId) return false;

    const hasEnvCreds = Boolean(
        (process.env.GOOGLE_WALLET_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL)?.trim() &&
        (process.env.GOOGLE_WALLET_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY)?.trim()
    );
    if (hasEnvCreds) return true;

    const credentialsPath = path.join(process.cwd(), 'google-service-account.json');
    return fs.existsSync(credentialsPath);
}

/**
 * Validates and retrieves the issuer ID from server environment variables.
 */
export function getIssuerId(): string {
    const raw = (process.env.GOOGLE_WALLET_ISSUER_ID || process.env.GOOGLE_ISSUER_ID)?.trim();
    if (!raw) {
        throw new Error('GOOGLE_WALLET_ISSUER_ID is not configured in server environment variables.');
    }
    return raw.replace(/['"]/g, '').trim();
}

export function getGoogleClassId(businessId: string): string {
    const issuerId = getIssuerId();
    const safeBusinessId = businessId.replace(/-/g, '_');
    return `${issuerId}.${safeBusinessId}`;
}

export function getGoogleObjectId(cardId: string): string {
    const issuerId = getIssuerId();
    const safeCardId = cardId.replace(/-/g, '_');
    return `${issuerId}.${safeCardId}`;
}

/**
 * Generates an authenticated Google API client.
 */
async function getAuthClient() {
    const credentials = loadCredentials();
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: SCOPES,
    });
    return auth.getClient();
}

/**
 * Creates or updates a Google Wallet Loyalty Class over the Wallet API.
 * Uses Patch if resource already exists, and Insert otherwise.
 */
export async function createOrUpdateLoyaltyClass(
    businessId: string,
    businessName: string,
    hexColor?: string,
    logoUrl?: string
): Promise<LoyaltyClassResponse> {
    const classId = getGoogleClassId(businessId);

    const authClient = await getAuthClient();
    const walletobjects = google.walletobjects({ version: 'v1', auth: authClient as any });

    const loyaltyClassPayload = {
        id: classId,
        issuerName: businessName,
        programName: businessName,
        reviewStatus: 'UNDER_REVIEW',
        hexBackgroundColor: hexColor || '#10B981',
        programLogo: {
            sourceUri: {
                uri: logoUrl || 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop&q=60'
            },
            contentDescription: {
                defaultValue: {
                    language: 'es-419',
                    value: `Logo de ${businessName}`
                }
            }
        }
    };

    try {
        try {
            // Check if the class exists
            await walletobjects.loyaltyclass.get({ resourceId: classId });

            // If it exists, update it
            await walletobjects.loyaltyclass.patch({
                resourceId: classId,
                requestBody: loyaltyClassPayload,
            });
        } catch (err: any) {
            // Status 404 indicates it doesn't exist, so insert it
            if (err.code === 404 || err.status === 404) {
                await walletobjects.loyaltyclass.insert({
                    requestBody: loyaltyClassPayload,
                });
            } else {
                throw err;
            }
        }
        return { id: classId, success: true };
    } catch (error: any) {
        console.error('Error in createOrUpdateLoyaltyClass:', error);
        throw new Error(`Fallo al generar LoyaltyClass: ${error.message}`);
    }
}

/**
 * Generates a signed JWT payload URL for the 'Save to Google Wallet' button.
 */
export function generateSavePassUrl(
    cardId: string,
    customerName: string,
    currentStamps: number,
    maxStamps: number,
    businessId: string
): string {
    const classId = getGoogleClassId(businessId);
    const objectId = getGoogleObjectId(cardId);

    const credentials = loadCredentials();

    const loyaltyObject = {
        id: objectId,
        classId: classId,
        state: 'ACTIVE',
        accountId: cardId, // Map barcode with ID
        accountName: customerName,
        barcode: {
            type: 'QR_CODE',
            value: cardId,
            alternateText: cardId
        },
        loyaltyPoints: {
            label: 'Sellos',
            balance: {
                int: currentStamps
            }
        }
    };

    const claims = {
        iss: credentials.client_email,
        aud: 'google',
        typ: 'savetowallet',
        origins: [],
        payload: {
            loyaltyObjects: [loyaltyObject]
        }
    };

    console.log("Generando JWT con claims:\n", JSON.stringify(claims, null, 2));

    const token = jwt.sign(claims, credentials.private_key, { algorithm: 'RS256' });

    return `https://pay.google.com/gp/v/save/${token}`;
}

export type UpdatePointsOptions = {
    targetStamps?: number;
    businessName?: string;
    notificationMessage?: string;
};

/**
 * Updates an existing Loyalty Object (pass) in Google Wallet with a new points balance.
 * Optionally triggers a push notification via TEXT_AND_NOTIFY.
 */
export async function updateLoyaltyPoints(
    cardId: string,
    currentStamps: number,
    options?: UpdatePointsOptions
): Promise<{ success: boolean; notFound?: boolean; error?: string }> {
    const objectId = getGoogleObjectId(cardId);

    try {
        const authClient = await getAuthClient();
        const walletobjects = google.walletobjects({ version: 'v1', auth: authClient as any });

        await walletobjects.loyaltyobject.patch({
            resourceId: objectId,
            requestBody: {
                loyaltyPoints: {
                    label: 'Sellos',
                    balance: {
                        int: currentStamps
                    }
                }
            }
        });

        // Si se solicita mensaje y notificación en pantalla de bloqueo
        if (options?.notificationMessage) {
            try {
                const messageId = `stamp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                await walletobjects.loyaltyobject.addmessage({
                    resourceId: objectId,
                    requestBody: {
                        message: {
                            id: messageId,
                            header: options.businessName || "Mimo Rewards",
                            body: options.notificationMessage,
                            messageType: 'TEXT_AND_NOTIFY',
                        }
                    }
                });
            } catch (msgErr: any) {
                console.warn(`[Google Wallet] No se pudo enviar addmessage a ${objectId}:`, msgErr?.message);
            }
        }

        return { success: true };
    } catch (err: any) {
        if (err.code === 404 || err.status === 404) {
            // El usuario aún no guardó el pase en Google Wallet
            return { success: false, notFound: true };
        }
        console.error(`[Google Wallet] Error updating loyalty points for ${objectId}:`, err);
        return { success: false, error: err?.message };
    }
}

/**
 * Envía una notificación masiva TEXT_AND_NOTIFY a nivel LoyaltyClass en Google Wallet.
 * Notifica a todos los dispositivos Android que tengan instalada la tarjeta del comercio.
 */
export async function broadcastGoogleWalletClassMessage(
    businessId: string,
    header: string,
    body: string
): Promise<{ success: boolean; error?: string }> {
    const classId = getGoogleClassId(businessId);

    try {
        const authClient = await getAuthClient();
        const walletobjects = google.walletobjects({ version: 'v1', auth: authClient as any });

        const messageId = `camp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await walletobjects.loyaltyclass.addmessage({
            resourceId: classId,
            requestBody: {
                message: {
                    id: messageId,
                    header,
                    body,
                    messageType: 'TEXT_AND_NOTIFY',
                }
            }
        });

        return { success: true };
    } catch (err: any) {
        console.error(`[Google Wallet] Error enviando broadcast addmessage a clase ${classId}:`, err);
        return { success: false, error: err?.message };
    }
}

