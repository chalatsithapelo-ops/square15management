// PR-5 — Default inspection templates for residential properties in SA.
// Each template defines rooms + items in a standard order. PMs can clone/edit.

export type TemplateItem = {
  name: string;
  category: "STRUCTURE" | "FIXTURES" | "APPLIANCES" | "SERVICES" | "FINISHES";
};

export type TemplateRoom = {
  name: string;
  type: "BEDROOM" | "BATHROOM" | "KITCHEN" | "LIVING" | "EXTERIOR" | "GARAGE" | "OTHER";
  displayOrder: number;
  items: TemplateItem[];
};

export type InspectionTemplate = {
  key: string;             // identifier for the system template
  name: string;
  description: string;
  buildingType: "RESIDENTIAL" | "COMMERCIAL";
  rooms: TemplateRoom[];
};

const COMMON_LIVING_ITEMS: TemplateItem[] = [
  { name: "Walls", category: "FINISHES" },
  { name: "Ceiling", category: "FINISHES" },
  { name: "Floor", category: "FINISHES" },
  { name: "Skirtings", category: "FINISHES" },
  { name: "Door", category: "STRUCTURE" },
  { name: "Door handle / lock", category: "FIXTURES" },
  { name: "Windows (glass + frames)", category: "STRUCTURE" },
  { name: "Window latches", category: "FIXTURES" },
  { name: "Window coverings (blinds/curtains)", category: "FIXTURES" },
  { name: "Light fittings", category: "FIXTURES" },
  { name: "Light switches", category: "SERVICES" },
  { name: "Plug points", category: "SERVICES" },
];

const KITCHEN_ITEMS: TemplateItem[] = [
  ...COMMON_LIVING_ITEMS,
  { name: "Kitchen cupboards", category: "FIXTURES" },
  { name: "Counter tops", category: "FIXTURES" },
  { name: "Sink + taps", category: "FIXTURES" },
  { name: "Splashback / tiles", category: "FINISHES" },
  { name: "Stove / oven", category: "APPLIANCES" },
  { name: "Extractor fan", category: "APPLIANCES" },
  { name: "Geyser (if visible)", category: "APPLIANCES" },
];

const BATHROOM_ITEMS: TemplateItem[] = [
  ...COMMON_LIVING_ITEMS,
  { name: "Toilet", category: "FIXTURES" },
  { name: "Basin + taps", category: "FIXTURES" },
  { name: "Bath / shower", category: "FIXTURES" },
  { name: "Shower screen / curtain rail", category: "FIXTURES" },
  { name: "Mirror / vanity", category: "FIXTURES" },
  { name: "Tiles (walls + floor)", category: "FINISHES" },
  { name: "Towel rail", category: "FIXTURES" },
  { name: "Toilet roll holder", category: "FIXTURES" },
];

const BEDROOM_ITEMS: TemplateItem[] = [
  ...COMMON_LIVING_ITEMS,
  { name: "Built-in cupboard doors", category: "FIXTURES" },
  { name: "Built-in cupboard interior (shelves, rails)", category: "FIXTURES" },
  { name: "Carpet (if applicable)", category: "FINISHES" },
];

const EXTERIOR_ITEMS: TemplateItem[] = [
  { name: "Front door + lock", category: "STRUCTURE" },
  { name: "Garage door + remote", category: "FIXTURES" },
  { name: "Garden / paving", category: "STRUCTURE" },
  { name: "Boundary wall / fence", category: "STRUCTURE" },
  { name: "Letterbox", category: "FIXTURES" },
  { name: "External lights", category: "SERVICES" },
  { name: "Intercom", category: "SERVICES" },
];

export const STANDARD_TEMPLATES: InspectionTemplate[] = [
  {
    key: "RES_BACHELOR",
    name: "Bachelor / Studio",
    description: "Single-room apartment with combined living/sleeping",
    buildingType: "RESIDENTIAL",
    rooms: [
      { name: "Living + sleeping area", type: "LIVING", displayOrder: 1, items: [...COMMON_LIVING_ITEMS, ...BEDROOM_ITEMS.slice(-3)] },
      { name: "Kitchenette", type: "KITCHEN", displayOrder: 2, items: KITCHEN_ITEMS },
      { name: "Bathroom", type: "BATHROOM", displayOrder: 3, items: BATHROOM_ITEMS },
      { name: "Exterior / common", type: "EXTERIOR", displayOrder: 4, items: EXTERIOR_ITEMS.slice(0, 4) },
    ],
  },
  {
    key: "RES_1BED",
    name: "1-bedroom apartment",
    description: "Standard 1-bedroom apartment",
    buildingType: "RESIDENTIAL",
    rooms: [
      { name: "Living room", type: "LIVING", displayOrder: 1, items: COMMON_LIVING_ITEMS },
      { name: "Kitchen", type: "KITCHEN", displayOrder: 2, items: KITCHEN_ITEMS },
      { name: "Bedroom", type: "BEDROOM", displayOrder: 3, items: BEDROOM_ITEMS },
      { name: "Bathroom", type: "BATHROOM", displayOrder: 4, items: BATHROOM_ITEMS },
      { name: "Exterior", type: "EXTERIOR", displayOrder: 5, items: EXTERIOR_ITEMS },
    ],
  },
  {
    key: "RES_2BED",
    name: "2-bedroom apartment",
    description: "Standard 2-bedroom apartment",
    buildingType: "RESIDENTIAL",
    rooms: [
      { name: "Living / dining", type: "LIVING", displayOrder: 1, items: COMMON_LIVING_ITEMS },
      { name: "Kitchen", type: "KITCHEN", displayOrder: 2, items: KITCHEN_ITEMS },
      { name: "Master bedroom", type: "BEDROOM", displayOrder: 3, items: BEDROOM_ITEMS },
      { name: "Bedroom 2", type: "BEDROOM", displayOrder: 4, items: BEDROOM_ITEMS },
      { name: "Bathroom", type: "BATHROOM", displayOrder: 5, items: BATHROOM_ITEMS },
      { name: "Exterior", type: "EXTERIOR", displayOrder: 6, items: EXTERIOR_ITEMS },
    ],
  },
  {
    key: "RES_3BED",
    name: "3-bedroom house",
    description: "Standard 3-bedroom freestanding/townhouse",
    buildingType: "RESIDENTIAL",
    rooms: [
      { name: "Lounge", type: "LIVING", displayOrder: 1, items: COMMON_LIVING_ITEMS },
      { name: "Dining room", type: "LIVING", displayOrder: 2, items: COMMON_LIVING_ITEMS },
      { name: "Kitchen", type: "KITCHEN", displayOrder: 3, items: KITCHEN_ITEMS },
      { name: "Master bedroom", type: "BEDROOM", displayOrder: 4, items: BEDROOM_ITEMS },
      { name: "Bedroom 2", type: "BEDROOM", displayOrder: 5, items: BEDROOM_ITEMS },
      { name: "Bedroom 3", type: "BEDROOM", displayOrder: 6, items: BEDROOM_ITEMS },
      { name: "Main bathroom", type: "BATHROOM", displayOrder: 7, items: BATHROOM_ITEMS },
      { name: "En-suite bathroom", type: "BATHROOM", displayOrder: 8, items: BATHROOM_ITEMS },
      { name: "Garage", type: "GARAGE", displayOrder: 9, items: [
        { name: "Garage door + remote", category: "FIXTURES" },
        { name: "Walls", category: "FINISHES" },
        { name: "Floor", category: "FINISHES" },
        { name: "Lights", category: "SERVICES" },
      ]},
      { name: "Exterior / Garden", type: "EXTERIOR", displayOrder: 10, items: EXTERIOR_ITEMS },
    ],
  },
];

export function getStandardTemplate(key: string): InspectionTemplate | undefined {
  return STANDARD_TEMPLATES.find((t) => t.key === key);
}
