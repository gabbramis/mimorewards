import { NextResponse } from 'next/server';
import { isSuperadmin } from '@/lib/authz';
import { createAdminClient } from '@/lib/supabase/admin';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

/** Sube el logo o el banner de Wallet (PNG/JPG/WebP) al bucket `logos` y devuelve su URL pública. */
export async function POST(request: Request) {
  if (!await isSuperadmin()) {
    return NextResponse.json({ error: 'No tenés permisos para subir imágenes.' }, { status: 403 });
  }
  const supabase: any = createAdminClient();
  try {
    const data = await request.formData();
    const kind = String(data.get('kind') || '');
    const file = data.get('file');
    if (kind !== 'logo' && kind !== 'banner') {
      return NextResponse.json({ error: 'Tipo de imagen inválido.' }, { status: 400 });
    }
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Elegí un archivo de imagen.' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'El archivo debe ser una imagen PNG, JPG o WebP.' }, { status: 400 });
    }

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `wallet-assets/${kind}-${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('logos').upload(path, file, { contentType: file.type });
    if (uploadError) {
      throw new Error(`No se pudo subir la imagen: ${uploadError.message}`);
    }
    const url: string = supabase.storage.from('logos').getPublicUrl(path).data.publicUrl;
    return NextResponse.json({ url });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo subir la imagen.' }, { status: 500 });
  }
}
