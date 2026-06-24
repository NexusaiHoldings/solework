export type NavLink = {
  label: string;
  href: string;
  external?: boolean;
};

export type NavGroup = {
  label: string;
  links: NavLink[];
};

export type NavConfig = {
  primary: NavLink[];
  secondary: NavLink[];
  groups: NavGroup[];
};

export const NAV_CONFIG: NavConfig = {
  primary: [
    { label: "Home", href: "/" },
    { label: "Design Studio", href: "/studio" },
    { label: "Best Sellers", href: "/shop" },
    { label: "My Orders", href: "/orders" },
    { label: "Saved Designs", href: "/designs" },
  ],
  secondary: [],
  groups: [
    {
      label: "Admin",
      links: [
        { label: "SKU Management", href: "/admin/skus" },
        { label: "Print Queue", href: "/admin/print-queue" },
      ],
    },
  ],
};
