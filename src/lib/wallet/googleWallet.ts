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
 */
function loadCredentials(): WalletCredentials {
    const credentialsPath = path.join(process.cwd(), 'google-service-account.json');
    if (!fs.existsSync(credentialsPath)) {
        throw new Error('Google Wallet service account credentials file (google-service-account.json) no se encontró en la raíz del proyecto.');
    }
    const fileContent = fs.readFileSync(credentialsPath, 'utf8');
    return JSON.parse(fileContent);
}

/**
 * Validates the existence of the issuer ID in environment variables.
 */
function getIssuerId(): string {
    const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
    if (!issuerId) {
        throw new Error('La variable de entorno GOOGLE_WALLET_ISSUER_ID no está definida en .env.local.');
    }
    return issuerId;
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
    const issuerId = getIssuerId();
    const safeBusinessId = businessId.replace(/-/g, '_');
    const classId = `${issuerId}.${safeBusinessId}`;

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
    const issuerId = getIssuerId();
    const safeBusinessId = businessId.replace(/-/g, '_');
    const classId = `${issuerId}.${safeBusinessId}`;
    const safeCardId = cardId.replace(/-/g, '_');
    const objectId = `${issuerId}.${safeCardId}`;

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
            // Note: 'maxStamps' is not natively standardized inside 'loyaltyPoints.balance',
            // but 'currentStamps' is represented as requested. Typically we could show it in textual labels.
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

    console.log("Generando JWT con claims:\\n", JSON.stringify(claims, null, 2));

    const token = jwt.sign(claims, credentials.private_key, { algorithm: 'RS256' });

    return `https://pay.google.com/gp/v/save/${token}`;
}

/**
 * Updates an existing Loyalty Object (pass) in Google Wallet with a new points balance.
 */
export async function updateLoyaltyPoints(
    cardId: string,
    currentStamps: number
): Promise<void> {
    const issuerId = getIssuerId();
    const safeCardId = cardId.replace(/-/g, '_');
    const objectId = `${issuerId}.${safeCardId}`;

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
}
