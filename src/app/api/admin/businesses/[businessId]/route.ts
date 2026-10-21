import { NextResponse, after } from 'next/server';
import { isSuperadmin } from '@/lib/authz';
import { createAdminClient } from '@/lib/supabase/admin';
import { availableStamp } from '@/lib/stamp-catalog';
import { validateEffect } from '@/lib/stamp-image';
import { prepareStamp, storeStampPair } from '@/lib/stamp-storage';
import { sanitizeWalletConfig } from '@/lib/wallet-config';
import { updateWalletTemplate } from '@/lib/wallet/sync-template';

const color = (value: FormDataEntryValue | null) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : null;

async function storedLogoFile(supabase: any, url: string | null): Promise<File> {
  if (!url) throw new Error('Subí primero un logo PNG transparente para usarlo como sello.');
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error('Falta la configuración de almacenamiento.');
  const prefix = `${base.replace(/\/$/, '')}/storage/v1/object/public/logos/`;
  if (!url.startsWith(prefix)) throw new Error('Volvé a subir el logo como PNG transparente para usarlo como sello.');
  const path = decodeURIComponent(url.slice(prefix.length));
  if (!path || path.includes('..')) throw new Error('La ruta del logo no es válida.');
  const { data, error } = await supabase.storage.from('logos').download(path);
  if (error || !data) throw new Error('No se pudo leer el logo actual. Subilo nuevamente.');
  return new File([data], 'logo.png', { type: data.type || 'image/png' });
}

export async function PUT(request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  if (!await isSuperadmin()) return NextResponse.json({ error: 'No tenés permisos para editar negocios.' }, { status: 403 });
  const { businessId } = await params;
  const supabase: any = createAdminClient();
  const createdPaths: string[] = [];
  try {
    const data = await request.formData();
    const name = String(data.get('name') || '').trim();
    const rewardTarget = Number(data.get('rewardTarget'));
    const rewardDescription = String(data.get('rewardDescription') || '').trim() || 'Un beneficio gratis';
    const primaryColor = color(data.get('primaryColor'));
    const textColor = color(data.get('cardTextColor'));
    const accentColor = color(data.get('cardAccentColor'));
    if (!name || name.length > 120 || !Number.isInteger(rewardTarget) || rewardTarget < 4 || rewardTarget > 15 || !primaryColor || !textColor || !accentColor) {
      return NextResponse.json({ error: 'Revisá el nombre, los colores y la meta de 4 a 15 sellos.' }, { status: 400 });
    }
    const { data: existing, error: readError } = await supabase.from('businesses').select('id, logo_url, reward_target, reward_description, stamp_source, stamp_catalog_id, stamp_completed_url, stamp_pending_url, stamp_pending_effect').eq('id', businessId).maybeSingle();
    if (readError) throw readError;
    if (!existing) return NextResponse.json({ error: 'El negocio no existe.' }, { status: 404 });

    if (rewardTarget !== (existing.reward_target || 10) || rewardDescription !== (existing.reward_description || 'Un beneficio gratis')) {
      const { count, error: countError } = await supabase.from('customers').select('id', { count: 'exact', head: true }).eq('business_id', businessId);
      if (countError) throw countError;
      if ((count || 0) > 0) return NextResponse.json({ error: 'Este negocio ya tiene clientes. La meta y el premio requieren una migración separada para conservar el significado de sus sellos acumulados.' }, { status: 409 });
    }

    const logo = data.get('logo');
    const logoFile = logo instanceof File && logo.size > 0 ? logo : null;
    if (logoFile && (!['image/png', 'image/jpeg', 'image/webp'].includes(logoFile.type) || logoFile.size > 800 * 1024)) {
      return NextResponse.json({ error: 'El logo debe ser PNG, JPG o WebP de hasta 800 KB.' }, { status: 400 });
    }
    const source = String(data.get('stampSource') || '');
    if (source && !['collection', 'custom', 'logo'].includes(source)) return NextResponse.json({ error: 'Origen del sello inválido.' }, { status: 400 });
    let effect;
    try { effect = validateEffect(JSON.parse(String(data.get('stampEffect') || '{}'))); } catch { effect = validateEffect(null); }
    let walletConfig;
    try { walletConfig = sanitizeWalletConfig(JSON.parse(String(data.get('walletConfig') || '{}'))); } catch { walletConfig = sanitizeWalletConfig(null); }
    const catalogId = String(data.get('stampCatalogId') || '');
    const stamp = data.get('stampFile');
    const stampFile = stamp instanceof File && stamp.size > 0 ? stamp : null;
    let completedUrl: string | null = existing.stamp_completed_url;
    let pendingUrl: string | null = existing.stamp_pending_url;
    let selectedId: string | null = null;
    if (source === 'collection') {
      const selected = availableStamp(catalogId);
      if (!selected) return NextResponse.json({ error: 'Este motivo aún no tiene las dos ilustraciones finales. Elegí otro origen.' }, { status: 400 });
      completedUrl = selected.completed; pendingUrl = selected.pending; selectedId = selected.id;
    } else if (!source) { completedUrl = null; pendingUrl = null; }
    else if (source === existing.stamp_source && !stampFile && !logoFile && JSON.stringify(effect) === JSON.stringify(validateEffect(existing.stamp_pending_effect)) && completedUrl && pendingUrl) {
      // La personalización ya está persistida; no generar archivos nuevos por un cambio de nombre o color.
    } else {
      let input: File | null = source === 'logo' ? logoFile : stampFile;
      if (!input && source === 'logo') input = await storedLogoFile(supabase, existing.logo_url);
      if (!input && source === 'custom' && existing.stamp_source === 'custom') input = await storedLogoFile(supabase, existing.stamp_completed_url);
      if (!input) return NextResponse.json({ error: 'Subí un PNG transparente para el sello personalizado.' }, { status: 400 });
      const pair = await prepareStamp(input, effect);
      const stored = await storeStampPair(supabase, businessId, pair);
      createdPaths.push(...stored.paths);
      completedUrl = stored.completedUrl; pendingUrl = stored.pendingUrl;
    }

    let logoUrl = existing.logo_url;
    if (logoFile) {
      const extension = logoFile.type === 'image/png' ? 'png' : logoFile.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `businesses/${businessId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('logos').upload(path, logoFile, { contentType: logoFile.type });
      if (uploadError) throw new Error(`No se pudo guardar el logo: ${uploadError.message}`);
      createdPaths.push(path);
      logoUrl = supabase.storage.from('logos').getPublicUrl(path).data.publicUrl;
    }

    const { data: updated, error: updateError } = await supabase.from('businesses').update({
      name, active: data.get('active') !== 'false', reward_target: rewardTarget, reward_description: rewardDescription,
      logo_url: logoUrl, primary_color: primaryColor, card_text_color: textColor, card_accent_color: accentColor,
      stamp_source: source || null, stamp_catalog_id: selectedId, stamp_completed_url: completedUrl, stamp_pending_url: pendingUrl,
      stamp_pending_effect: source === 'custom' || source === 'logo' ? effect : null,
      wallet_config: walletConfig,
    }).eq('id', businessId).select('id, name').single();
    if (updateError || !updated) throw updateError || new Error('No se pudo actualizar el negocio.');

    // Propagación asíncrona de plantilla Wallet (Google Wallet PATCH + Apple Wallet APNs)
    // Se ejecuta de fondo para no bloquear ni demorar la respuesta de guardado del frontend
    if (typeof after === 'function') {
      after(async () => {
        try {
          await updateWalletTemplate(businessId);
        } catch (syncErr) {
          console.error('[Admin Business Update] Error en propagación asíncrona de plantilla Wallet:', syncErr);
        }
      });
    } else {
      updateWalletTemplate(businessId).catch((syncErr) => {
        console.error('[Admin Business Update] Error en propagación asíncrona de plantilla Wallet:', syncErr);
      });
    }

    return NextResponse.json({ business: updated });
  } catch (error: unknown) {
    if (createdPaths.length) await supabase.storage.from('logos').remove(createdPaths);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo guardar el negocio.' }, { status: 500 });
  }
}
