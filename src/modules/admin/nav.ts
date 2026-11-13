export type NavItem = { href: string; label: string; ownerOnly?: boolean; group: string };

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Resumen", group: "General" },
  { href: "/admin/pedidos", label: "Pedidos", group: "Ventas" },
  { href: "/admin/clientes", label: "Clientes", group: "Ventas" },
  { href: "/admin/productos", label: "Productos", group: "Catálogo" },
  { href: "/admin/importar", label: "Carga masiva", group: "Catálogo" },
  { href: "/admin/kits", label: "Kits", group: "Catálogo" },
  { href: "/admin/categorias", label: "Categorías", group: "Catálogo" },
  { href: "/admin/atributos", label: "Atributos técnicos", group: "Catálogo" },
  { href: "/admin/apariencia", label: "Apariencia", group: "Tienda", ownerOnly: true },
  { href: "/admin/inicio", label: "Contenido del inicio", group: "Tienda", ownerOnly: true },
  { href: "/admin/despacho", label: "Despacho y retiro", group: "Tienda", ownerOnly: true },
  { href: "/admin/pagos", label: "Medios de pago", group: "Tienda", ownerOnly: true },
  { href: "/admin/usuarios", label: "Usuarios", group: "Tienda", ownerOnly: true },
];
