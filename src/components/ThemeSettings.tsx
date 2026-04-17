import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PALETTES } from '@/lib/theme';
import { useThemeStore } from '@/store/useThemeStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Separator } from '@/components/ui/separator';

export function ThemeSettings() {
  const mode = useThemeStore(s => s.mode);
  const palette = useThemeStore(s => s.palette);
  const setMode = useThemeStore(s => s.setMode);
  const setPalette = useThemeStore(s => s.setPalette);

  return (
    <Card className="border-border shadow-xl">
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Choose a theme mode and accent color.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {/* Mode */}
        <div className="flex flex-col gap-2">
          <Label>Mode</Label>
          <ToggleGroup
            type="single"
            variant="outline"
            value={mode}
            onValueChange={(v) => { if (v) setMode(v as 'dark' | 'light'); }}
          >
            <ToggleGroupItem value="dark">
              <Moon data-icon="inline-start" />
              Dark
            </ToggleGroupItem>
            <ToggleGroupItem value="light">
              <Sun data-icon="inline-start" />
              Light
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <Separator />

        {/* Palette */}
        <div className="flex flex-col gap-3">
          <Label>Accent Color</Label>
          <div className="flex flex-wrap gap-3">
            {PALETTES.map(p => (
              <button
                key={p.id}
                title={p.name}
                onClick={() => setPalette(p.id)}
                className={cn(
                  'size-8 rounded-full border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  palette === p.id
                    ? 'border-foreground scale-110 shadow-md'
                    : 'border-border/50 hover:scale-105 hover:border-foreground/50'
                )}
                style={{ backgroundColor: p.swatch }}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground capitalize">
            {PALETTES.find(p => p.id === palette)?.name ?? palette}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
