'use client';

import React from 'react';
import { Beer, Wine, CupSoda, Coffee, Martini, Utensils, type LucideIcon } from 'lucide-react';

/**
 * Spec 3.2: Im gesamten System sind Unicode-Emojis ausnahmslos verboten.
 * Alle Warengruppen-Symbole werden ausschliesslich als SVG ueber lucide-react gerendert.
 */
export const SUBCATEGORY_ICONS: Record<string, LucideIcon> = {
  BIER: Beer,
  WEIN: Wine,
  ALKOHOLFREI: CupSoda,
  HEISS: Coffee,
  BAR: Martini,
  SPEISEN: Utensils,
};

export const SUBCATEGORY_LABELS: Record<string, string> = {
  BIER: 'Bier & Radler',
  WEIN: 'Wein & Schorle',
  ALKOHOLFREI: 'Alkoholfrei / Softdrinks',
  HEISS: 'Kaffee & Tee',
  BAR: 'Bar & Spirituosen',
  SPEISEN: 'Speisen & Küche',
};

export interface SubCategoryIconProps {
  subCategory?: string | null;
  className?: string;
}

export function SubCategoryIcon({ subCategory, className = 'w-5 h-5' }: SubCategoryIconProps) {
  const Icon = (subCategory && SUBCATEGORY_ICONS[subCategory]) || Utensils;
  return <Icon className={className} aria-hidden="true" />;
}

export default SubCategoryIcon;
