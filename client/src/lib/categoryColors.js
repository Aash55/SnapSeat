// One palette for seat categories across the app (seat map, checkout, ticket, analytics),
// assigned by the category's position within its event: 1st = blue, 2nd = aqua, ...
export const CATEGORY_COLORS = ['#3987e5', '#199e70', '#d95926', '#c05fd3', '#5fb0c0', '#e0a53a', '#e0607e', '#8fb34a', '#7a86e8', '#c9a227'];

export const categoryColor = (index = 0) => CATEGORY_COLORS[((index % CATEGORY_COLORS.length) + CATEGORY_COLORS.length) % CATEGORY_COLORS.length];
