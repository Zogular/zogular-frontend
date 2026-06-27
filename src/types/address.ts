export type AddressType = "Home" | "Work";

export interface Address {
  id: string;
  name: string;
  type: AddressType;
  street: string;
  area: string;
  city: string;
  phone: string;
  deliveryInstructions?: string | null;
  isDefault: boolean;
}
