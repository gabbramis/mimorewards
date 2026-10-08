const email = "contactomimorewards@gmail.com";
const subject = "Quiero agendar una demo de mimo";
const body = "Hola, quiero coordinar una demo de mimo para mi local.\n\nNombre del local:\nRubro:\nNombre y teléfono de contacto:\n";

export const demoHref = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
