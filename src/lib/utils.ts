import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Serialize a Point3D to a string key for use in Maps. */
export function pointKey(p: { x: number; y: number; z: number }): string {
  return `${p.x},${p.y},${p.z}`;
}

export function normalizeLocationName(name: string | null | undefined): string {
  return String(name ?? '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function stableHash(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}
