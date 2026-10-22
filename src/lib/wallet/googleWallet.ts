import "server-only";

import { google } from 'googleapis';
import jwt from 'jsonwebtoken';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'node:crypto';
import { googleBarcodeType, isHttpsUrl, resolveWalletText, sanitizeWalletConfig } from '@/lib/wallet-config';

export interface WalletCredentials {
    client_email: string;
    private_key: string;
}

export interface LoyaltyClassResponse {
    id: string;
    success: boolean;
}

const SCOPES = ['https://www.googleapis.com/auth/wallet_object.issuer'];

const stripQuotes = (value: string) => value.trim().replace(/^["']|["']$/g, '').trim();

/**
 * Normaliza la private_key de la Service Account para que OpenSSL pueda decodificarla.
 * Cubre los casos típicos que producen `error:1E08010C:DECODER routines::unsupported`:
 *  - Saltos de línea literales (`\n`, `\r\n`) guardados en la variable de entorno.
 *  - Comillas envolventes agregadas por el panel de variables (Vercel, .env, etc.).
 *  - PEM completo codificado en base64.
 *  - Body base64 sin headers (se asume PKCS#8, formato estándar de Google).
 * Respeta el tipo de header original (PKCS#8 `PRIVATE KEY` vs PKCS#1 `RSA PRIVATE KEY`).
 */
function formatPrivateKey(rawKey: string): string {
    let key = stripQuotes(rawKey)
        .replace(/\\r\\n/g, '\n')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '')
        .replace(/\r/g, '');

    // PEM completo guardado en base64
    if (!key.includes('-----BEGIN') && /^[A-Za-z0-9+/=\s]+$/.test(key)) {
        const decoded = Buffer.from(key.replace(/\s/g, ''), 'base64').toString('utf8');
        if (decoded.includes('-----BEGIN')) {
            key = decoded.replace(/\\n/g, '\n').replace(/\r/g, '');
        }
    }

    const match = key.match(/-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/);
    const label = match ? match[1] : 'PRIVATE KEY';
    const body = (match ? match[2] : key).replace(/[^A-Za-z0-9+/=]/g, '');
    const chunks = body.match(/.{1,64}/g) || [];
    return `-----BEGIN ${label}-----\n${chunks.join('\n')}\n-----END ${label}-----\n`;
}

/** Valida la clave con OpenSSL para fallar con un mensaje claro en vez de un error críptico en runtime. */
function assertValidPrivateKey(pem: string, source: string): void {
    try {
        crypto.createPrivateKey({ key: pem, format: 'pem' });
    } catch (err: any) {
        throw new Error(
            `Google Wallet: la private_key de ${source} no es válida (${err?.message || err}). ` +
            'Revisá que sea el valor "private_key" completo del JSON de la Service Account, incluyendo BEGIN/END.'
        );
    }
}

function credentialsFromJson(json: string, source: string): WalletCredentials {
    let parsed: any;
    try {
        parsed = JSON.parse(json);
    } catch {
        // Puede venir el JSON completo codificado en base64
        parsed = JSON.parse(Buffer.from(json, 'base64').toString('utf8'));
    }
    if (!parsed?.client_email || !parsed?.private_key) {
        throw new Error(`${source} no contiene client_email o private_key válidos.`);
    }
    const private_key = formatPrivateKey(String(parsed.private_key));
    assertValidPrivateKey(private_key, source);
    return { client_email: stripQuotes(String(parsed.client_email)), private_key };
}

const credentialsJsonEnv = () =>
    (process.env.GOOGLE_WALLET_CREDENTIALS_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)?.trim();

let cachedCredentials: WalletCredentials | null = null;

/**
 * Carga las credenciales de la Service Account de Google Wallet. Prioridad:
 *  1. GOOGLE_WALLET_CLIENT_EMAIL / GOOGLE_CLIENT_EMAIL + GOOGLE_WALLET_PRIVATE_KEY / GOOGLE_PRIVATE_KEY
 *  2. GOOGLE_WALLET_CREDENTIALS_JSON / GOOGLE_APPLICATION_CREDENTIALS_JSON (JSON completo, plano o base64)
 *  3. google-service-account.json en la raíz del proyecto
 */
function loadCredentials(): WalletCredentials {
    if (cachedCredentials) return cachedCredentials;

    const envEmail = (process.env.GOOGLE_WALLET_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL)?.trim();
    const envPrivateKey = (process.env.GOOGLE_WALLET_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY)?.trim();

    if (envEmail && envPrivateKey) {
        const private_key = formatPrivateKey(envPrivateKey);
        assertValidPrivateKey(private_key, 'GOOGLE_WALLET_PRIVATE_KEY/GOOGLE_PRIVATE_KEY');
        cachedCredentials = { client_email: stripQuotes(envEmail), private_key };
        return cachedCredentials;
    }

    const jsonEnv = credentialsJsonEnv();
    if (jsonEnv) {
        cachedCredentials = credentialsFromJson(jsonEnv, 'GOOGLE_APPLICATION_CREDENTIALS_JSON');
        return cachedCredentials;
    }

    const credentialsPath = path.join(process.cwd(), 'google-service-account.json');
    if (!fs.existsSync(credentialsPath)) {
        throw new Error('Google Wallet credentials: no se encontraron credenciales en variables de entorno ni el archivo google-service-account.json.');
    }
    cachedCredentials = credentialsFromJson(fs.readFileSync(credentialsPath, 'utf8'), 'google-service-account.json');
    return cachedCredentials;
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
    if (hasEnvCreds || credentialsJsonEnv()) return true;

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
    return raw.replace(/^["']|["']$/g, '').trim();
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
    logoUrl?: string,
    walletConfig?: unknown
): Promise<LoyaltyClassResponse> {
    const classId = getGoogleClassId(businessId);
    const wallet = sanitizeWalletConfig(walletConfig);
    const issuerName = wallet.issuerName || businessName;
    const programLogoUri = (isHttpsUrl(wallet.logoUrl) ? wallet.logoUrl : '') || logoUrl || 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop&q=60';

    const authClient = await getAuthClient();
    const walletobjects = google.walletobjects({ version: 'v1', auth: authClient as any });

    const loyaltyClassPayload: Record<string, unknown> = {
        id: classId,
        issuerName,
        programName: issuerName,
        reviewStatus: 'UNDER_REVIEW',
        hexBackgroundColor: hexColor || '#10B981',
        programLogo: {
            sourceUri: {
                uri: programLogoUri
            },
            contentDescription: {
                defaultValue: {
                    language: 'es-419',
                    value: `Logo de ${issuerName}`
                }
            }
        }
    };

    if (wallet.bannerEnabled && isHttpsUrl(wallet.bannerUrl)) {
        loyaltyClassPayload.heroImage = {
            sourceUri: { uri: wallet.bannerUrl },
            contentDescription: {
                defaultValue: { language: 'es-419', value: `Banner de ${issuerName}` }
            }
        };
    }

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
        const details = error?.response?.data ? JSON.stringify(error.response.data) : error?.message || 'Error desconocido';
        const status = error?.status || error?.code || error?.response?.status || '';
        throw new Error(`Google Wallet API error (${status ? `status ${status}: ` : ''}${details})`);
    }
}

/**
 * Actualiza la plantilla (LoyaltyClass) en Google Wallet vía PATCH (o INSERT si no existía).
 * Envía los nuevos valores de wallet_config: hexBackgroundColor, heroImage, programLogo y issuerName.
 * Al actualizar la Class, Google Wallet propaga automáticamente los cambios a todas las tarjetas de usuarios vinculados.
 */
export async function patchGoogleWalletLoyaltyClass(
    businessId: string,
    params: {
        businessName: string;
        hexBackgroundColor?: string | null;
        logoUrl?: string | null;
        walletConfig?: unknown;
    }
): Promise<{ success: boolean; id: string; error?: string }> {
    if (!googleWalletConfigured()) {
        console.warn(`[Google Wallet] Credenciales no configuradas. Omitiendo PATCH de LoyaltyClass para negocio: ${businessId}`);
        return { success: false, id: '', error: 'Credenciales de Google Wallet no configuradas' };
    }

    const classId = getGoogleClassId(businessId);
    const wallet = sanitizeWalletConfig(params.walletConfig);
    const issuerName = wallet.issuerName || params.businessName;
    const programLogoUri = (isHttpsUrl(wallet.logoUrl) ? wallet.logoUrl : '') || params.logoUrl || 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop&q=60';

    const authClient = await getAuthClient();
    const walletobjects = google.walletobjects({ version: 'v1', auth: authClient as any });

    const patchPayload: Record<string, unknown> = {
        issuerName,
        programName: issuerName,
        hexBackgroundColor: params.hexBackgroundColor || '#10B981',
        programLogo: {
            sourceUri: { uri: programLogoUri },
            contentDescription: {
                defaultValue: {
                    language: 'es-419',
                    value: `Logo de ${issuerName}`,
                },
            },
        },
    };

    if (wallet.bannerEnabled && isHttpsUrl(wallet.bannerUrl)) {
        patchPayload.heroImage = {
            sourceUri: { uri: wallet.bannerUrl },
            contentDescription: {
                defaultValue: { language: 'es-419', value: `Banner de ${issuerName}` },
            },
        };
    } else {
        // Enviar null para borrar la imagen en Google Wallet si fue desactivada
        patchPayload.heroImage = null;
    }

    try {
        try {
            await walletobjects.loyaltyclass.patch({
                resourceId: classId,
                requestBody: patchPayload,
            });
            console.log(`[Google Wallet] LoyaltyClass ${classId} actualizada vía PATCH con éxito.`);
            return { success: true, id: classId };
        } catch (patchErr: any) {
            // Si dio 400 por enviar heroImage: null, reintentar sin heroImage
            if (patchPayload.heroImage === null && (patchErr.code === 400 || patchErr.status === 400)) {
                const retryPayload = { ...patchPayload };
                delete retryPayload.heroImage;
                await walletobjects.loyaltyclass.patch({
                    resourceId: classId,
                    requestBody: retryPayload,
                });
                console.log(`[Google Wallet] LoyaltyClass ${classId} actualizada vía PATCH (fallback sin heroImage).`);
                return { success: true, id: classId };
            }

            // Si la clase no existía (404), insertarla con INSERT
            if (patchErr.code === 404 || patchErr.status === 404) {
                console.log(`[Google Wallet] LoyaltyClass ${classId} no existía (404). Insertando...`);
                const insertPayload: Record<string, unknown> = {
                    ...patchPayload,
                    id: classId,
                    reviewStatus: 'UNDER_REVIEW',
                };
                if (!insertPayload.heroImage) {
                    delete insertPayload.heroImage;
                }
                await walletobjects.loyaltyclass.insert({
                    requestBody: insertPayload,
                });
                console.log(`[Google Wallet] LoyaltyClass ${classId} creada vía INSERT con éxito.`);
                return { success: true, id: classId };
            }

            throw patchErr;
        }
    } catch (error: any) {
        console.error(`[Google Wallet] Error en patchGoogleWalletLoyaltyClass para ${classId}:`, error?.message || error);
        const details = error?.response?.data ? JSON.stringify(error.response.data) : error?.message || 'Error desconocido';
        return { success: false, id: classId, error: details };
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
    businessId: string,
    walletConfig?: unknown,
    rewardDescription?: string,
    customerCode?: string
): string {
    const classId = getGoogleClassId(businessId);
    const objectId = getGoogleObjectId(cardId);

    const credentials = loadCredentials();

    const wallet = sanitizeWalletConfig(walletConfig);
    const firstName = customerName.split(' ')[0] || customerName;
    const headline = resolveWalletText(wallet.headline, { nombre: firstName, proximo_premio: rewardDescription });
    const reward = resolveWalletText(wallet.rewardText || '{proximo_premio}', { nombre: customerName, proximo_premio: rewardDescription }) || rewardDescription || '';
    const altText = resolveWalletText(wallet.barcodeAltText, { id: customerCode || cardId });
    const textModulesData = [
        headline ? { id: 'headline', header: 'Tu tarjeta', body: headline } : null,
        reward ? { id: 'reward', header: 'Próximo premio', body: reward } : null,
    ].filter(Boolean);

    const loyaltyObject = {
        id: objectId,
        classId: classId,
        state: 'ACTIVE',
        accountId: cardId, // Map barcode with ID
        accountName: customerName,
        barcode: {
            type: googleBarcodeType(wallet.barcodeFormat),
            value: cardId,
            ...(altText ? { alternateText: altText } : {})
        },
        ...(textModulesData.length ? { textModulesData } : {}),
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

