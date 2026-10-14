export type StampMotif = { id: string; name: string; category: string; completed: string | null; pending: string | null };

// Añadir aquí las rutas de los dos PNG finales cuando cada ilustración esté disponible.
export const stampCatalog: StampMotif[] = [
  ['nigiri', 'Nigiri', 'Sushi'], ['maki', 'Maki', 'Sushi'], ['palitos-sushi', 'Palitos de sushi', 'Sushi'],
  ['hamburguesa', 'Hamburguesa', 'Comida'], ['medialuna', 'Medialuna', 'Panadería'], ['croissant', 'Croissant', 'Panadería'],
  ['taza-cafe', 'Taza de café', 'Café'], ['granos-cafe', 'Granos de café', 'Café'], ['pizza-entera', 'Pizza entera', 'Comida'],
  ['porcion-pizza', 'Porción de pizza', 'Comida'], ['papas-fritas', 'Papas fritas', 'Comida'], ['cookie', 'Cookie', 'Dulces'],
  ['cupcake', 'Cupcake', 'Dulces'], ['coctel', 'Cóctel', 'Bebidas'], ['esmalte-unas', 'Esmalte de uñas', 'Belleza'],
  ['copa-helado', 'Copa de helado', 'Dulces'], ['donut', 'Donut', 'Dulces'], ['corazon', 'Corazón', 'Otros'],
  ['plantita', 'Plantita', 'Otros'], ['cerveza', 'Cerveza', 'Bebidas'], ['botella-vino', 'Botella de vino', 'Bebidas'],
  ['copa-vino', 'Copa de vino', 'Bebidas'], ['flor', 'Flor', 'Otros'],
].map(([id, name, category]) => ({ id, name, category, completed: null, pending: null }));

export const availableStamp = (id: string) => stampCatalog.find((item) => item.id === id && item.completed && item.pending);
