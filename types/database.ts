export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type FuelType = "Essence" | "Diesel" | "Hybride" | "Électrique" | "GPL";
export type TransmissionType = "Manuelle" | "Automatique";
export type BodyType =
  | "Berline"
  | "SUV"
  | "Citadine"
  | "Break"
  | "Coupé"
  | "Utilitaire";
export type CarCondition = "Neuf" | "Occasion";
export type CarStatus = "Disponible" | "Réservé" | "Vendu";

export type CarImage = {
  public_id: string;
  url: string;
  width: number;
  height: number;
};

export type CarRow = {
  id: string;
  slug: string;
  brand: string;
  model: string;
  year: number;
  price: number | null;
  price_on_request: boolean;
  mileage: number;
  fuel: FuelType;
  transmission: TransmissionType;
  body_type: BodyType;
  color: string | null;
  power: string | null;
  engine: string | null;
  doors: number | null;
  seats: number | null;
  condition: CarCondition;
  status: CarStatus;
  featured: boolean;
  published: boolean;
  description: string | null;
  description_en?: string | null;
  description_ar?: string | null;
  features: string[];
  features_en?: string[];
  features_ar?: string[];
  images: CarImage[];
  created_at: string;
  updated_at: string;
};

export type CarInsert = {
  id?: string;
  slug: string;
  brand: string;
  model: string;
  year: number;
  price?: number | null;
  price_on_request?: boolean;
  mileage?: number;
  fuel: FuelType;
  transmission: TransmissionType;
  body_type: BodyType;
  color?: string | null;
  power?: string | null;
  engine?: string | null;
  doors?: number | null;
  seats?: number | null;
  condition: CarCondition;
  status?: CarStatus;
  featured?: boolean;
  published?: boolean;
  description?: string | null;
  description_en?: string | null;
  description_ar?: string | null;
  features?: string[];
  features_en?: string[];
  features_ar?: string[];
  images?: CarImage[];
  created_at?: string;
  updated_at?: string;
};

export type CarUpdate = Partial<CarInsert>;

export type Database = {
  public: {
    Tables: {
      cars: {
        Row: CarRow;
        Insert: CarInsert;
        Update: CarUpdate;
        Relationships: [];
      };
      admin_config: {
        Row: {
          id: boolean;
          email: string;
          updated_at: string;
        };
        Insert: {
          id?: boolean;
          email: string;
          updated_at?: string;
        };
        Update: {
          id?: boolean;
          email?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
