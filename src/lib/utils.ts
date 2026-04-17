import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Serialize a Point3D to a string key for use in Maps. */
export function pointKey(p: { x: number; y: number; z: number }): string {
  return `${p.x},${p.y},${p.z}`;
}
