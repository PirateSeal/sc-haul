import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getLocationByName } from '@/services/db';
import { fetchCommodities } from '@/services/api';
import type { Commodity } from '@/services/api';
import type { MissionType, MissionCommodity, CargoEntry } from '@/store/useHaulStore';
import { useHaulStore } from '@/store/useHaulStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ---------------------------------------------------------------------------
// Local form types
// ---------------------------------------------------------------------------
type EntryRow = { id: string; commodity: string; scu: string };
type LocationGroup = { id: string; location: string; entries: EntryRow[] };

const uid = () => Math.random().toString(36).slice(2, 9);
const newEntry = (): EntryRow => ({ id: uid(), commodity: '', scu: '' });
const newGroup = (): LocationGroup => ({ id: uid(), location: '', entries: [newEntry()] });

// ---------------------------------------------------------------------------
// CargoEntryRow — one commodity line inside a group
// ---------------------------------------------------------------------------
function CargoEntryRow({
  entry,
  onChange,
  onRemove,
  canRemove,
  commodities,
}: {
  entry: EntryRow;
  onChange: (id: string, field: 'commodity' | 'scu', value: string) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
  commodities: Commodity[];
}) {
  const matched = commodities.find(c => c.name.toLowerCase() === entry.commodity.toLowerCase());
  return (
    <div className="flex items-center gap-2">
      <Input
        list="commodities-list"
        value={entry.commodity}
        onChange={e => onChange(entry.id, 'commodity', e.target.value)}
        placeholder="Commodity (optional)"
        className="flex-1 text-sm h-8"
      />
      <Input
        type="number"
        value={entry.scu}
        onChange={e => onChange(entry.id, 'scu', e.target.value)}
        placeholder="SCU"
        min="1"
        required
        className="w-24 text-sm h-8"
      />
      {matched?.is_illegal === 1 && (
        <span className="text-destructive text-xs shrink-0" title="Illegal commodity">⚠</span>
      )}
      {canRemove && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRemove(entry.id)}
          className="size-8 p-0 text-muted-foreground hover:text-destructive"
        >
          ×
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------
export function AddMissionForm({
  locationListId = 'locations-list',
  onClose,
}: {
  locationListId?: string;
  onClose?: () => void;
}) {
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [type, setType] = useState<MissionType>('direct');
  const [reward, setReward] = useState('');

  // Direct state
  const [directFrom, setDirectFrom] = useState('');
  const [directTo, setDirectTo] = useState('');
  const [directEntries, setDirectEntries] = useState<EntryRow[]>([newEntry()]);

  // Multi-pickup state: many from → one common to
  const [mpuTo, setMpuTo] = useState('');
  const [mpuGroups, setMpuGroups] = useState<LocationGroup[]>([newGroup()]);

  // Multi-dropoff state: one common from → many to
  const [mdoFrom, setMdoFrom] = useState('');
  const [mdoGroups, setMdoGroups] = useState<LocationGroup[]>([newGroup()]);

  const addMission = useHaulStore(state => state.addMission);

  // Load commodities once
  useEffect(() => {
    async function loadData() {
      try {
        const items = await fetchCommodities();
        items.sort((a, b) => {
          if (a.is_illegal !== b.is_illegal) return a.is_illegal - b.is_illegal;
          return a.name.localeCompare(b.name);
        });
        setCommodities(items);
      } catch { /* non-fatal */ }
    }
    loadData();
  }, []);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function resolveCommodity(name: string): MissionCommodity | undefined {
    const c = commodities.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (!c) return undefined;
    return { id: c.id, name: c.name, code: c.code, kind: c.kind, isIllegal: c.is_illegal === 1 };
  }

  function updateGroupEntry(
    setGroups: React.Dispatch<React.SetStateAction<LocationGroup[]>>,
    groupId: string,
    entryId: string,
    field: 'commodity' | 'scu',
    value: string
  ) {
    setGroups(gs => gs.map(g => g.id !== groupId ? g : {
      ...g,
      entries: g.entries.map(e => e.id !== entryId ? e : { ...e, [field]: value }),
    }));
  }

  function removeGroupEntry(
    setGroups: React.Dispatch<React.SetStateAction<LocationGroup[]>>,
    groupId: string,
    entryId: string
  ) {
    setGroups(gs => gs.map(g => g.id !== groupId ? g : {
      ...g,
      entries: g.entries.filter(e => e.id !== entryId),
    }));
  }

  function addGroupEntry(
    setGroups: React.Dispatch<React.SetStateAction<LocationGroup[]>>,
    groupId: string
  ) {
    setGroups(gs => gs.map(g => g.id !== groupId ? g : { ...g, entries: [...g.entries, newEntry()] }));
  }

  function setGroupLocation(
    setGroups: React.Dispatch<React.SetStateAction<LocationGroup[]>>,
    groupId: string,
    location: string
  ) {
    setGroups(gs => gs.map(g => g.id !== groupId ? g : { ...g, location }));
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let cargoEntries: CargoEntry[] = [];

    if (type === 'direct') {
      const [puLoc, doLoc] = await Promise.all([
        getLocationByName(directFrom),
        getLocationByName(directTo),
      ]);
      if (!puLoc) { alert(`Pickup location not found: "${directFrom}"`); return; }
      if (!doLoc) { alert(`Dropoff location not found: "${directTo}"`); return; }

      cargoEntries = directEntries.map(e => ({
        id: e.id,
        scu: parseInt(e.scu) || 0,
        pickupLocationName: puLoc.displayName,
        dropoffLocationName: doLoc.displayName,
        commodity: resolveCommodity(e.commodity),
      }));
    } else if (type === 'multi-pickup') {
      const doLoc = await getLocationByName(mpuTo);
      if (!doLoc) { alert(`Destination not found: "${mpuTo}"`); return; }

      for (const g of mpuGroups) {
        const puLoc = await getLocationByName(g.location);
        if (!puLoc) { alert(`Pickup location not found: "${g.location}"`); return; }
        g.entries.forEach(e => cargoEntries.push({
          id: e.id,
          scu: parseInt(e.scu) || 0,
          pickupLocationName: puLoc.displayName,
          dropoffLocationName: doLoc.displayName,
          commodity: resolveCommodity(e.commodity),
        }));
      }
    } else {
      // multi-dropoff
      const puLoc = await getLocationByName(mdoFrom);
      if (!puLoc) { alert(`Origin not found: "${mdoFrom}"`); return; }

      for (const g of mdoGroups) {
        const doLoc = await getLocationByName(g.location);
        if (!doLoc) { alert(`Destination not found: "${g.location}"`); return; }
        g.entries.forEach(e => cargoEntries.push({
          id: e.id,
          scu: parseInt(e.scu) || 0,
          pickupLocationName: puLoc.displayName,
          dropoffLocationName: doLoc.displayName,
          commodity: resolveCommodity(e.commodity),
        }));
      }
    }

    if (cargoEntries.length === 0 || cargoEntries.every(e => e.scu <= 0)) {
      alert('Add at least one cargo entry with an SCU amount.');
      return;
    }

    const totalScu = cargoEntries.reduce((sum, e) => sum + e.scu, 0);
    addMission({
      id: uid(),
      type,
      cargoEntries,
      reward: parseInt(reward) || 0,
    });

    toast.success('Contract added', {
      description: `${totalScu} SCU · ${(parseInt(reward) || 0).toLocaleString()} aUEC`,
    });

    if (onClose) onClose();
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  function renderEntryRows(
    entries: EntryRow[],
    onChange: (id: string, field: 'commodity' | 'scu', value: string) => void,
    onRemove: (id: string) => void,
    onAdd: () => void
  ) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-[1fr_6rem_1.5rem] gap-2 text-xs text-muted-foreground px-0.5">
          <span>Commodity</span><span>SCU</span><span />
        </div>
        {entries.map(e => (
          <CargoEntryRow
            key={e.id}
            entry={e}
            onChange={onChange}
            onRemove={onRemove}
            canRemove={entries.length > 1}
            commodities={commodities}
          />
        ))}
        <Button type="button" variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={onAdd}>
          + Add cargo type
        </Button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // JSX
  // ---------------------------------------------------------------------------
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4 border border-border rounded-xl bg-muted/30">
      {/* Hidden datalists */}
      <datalist id="commodities-list">
        {commodities.map((c, i) => <option key={i} value={c.name} />)}
      </datalist>

      {/* Mission type */}
      <div className="flex flex-col gap-1.5">
        <Label>Mission Type</Label>
        <Select value={type} onValueChange={(v: MissionType) => setType(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="direct">Direct — one pickup → one dropoff</SelectItem>
            <SelectItem value="multi-pickup">Multi-Pickup — many pickups → one dropoff</SelectItem>
            <SelectItem value="multi-dropoff">Multi-Dropoff — one pickup → many dropoffs</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── DIRECT ─────────────────────────────────────────────────── */}
      {type === 'direct' && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Pickup (From)</Label>
              <Input list={locationListId} value={directFrom} onChange={e => setDirectFrom(e.target.value)}
                placeholder="Search location…" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Dropoff (To)</Label>
              <Input list={locationListId} value={directTo} onChange={e => setDirectTo(e.target.value)}
                placeholder="Search location…" required />
            </div>
          </div>
          {renderEntryRows(
            directEntries,
            (id, field, value) => setDirectEntries(es => es.map(e => e.id === id ? { ...e, [field]: value } : e)),
            (id) => setDirectEntries(es => es.filter(e => e.id !== id)),
            () => setDirectEntries(es => [...es, newEntry()])
          )}
        </div>
      )}

      {/* ── MULTI-PICKUP ────────────────────────────────────────────── */}
      {type === 'multi-pickup' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Common Destination (To)</Label>
            <Input list={locationListId} value={mpuTo} onChange={e => setMpuTo(e.target.value)}
              placeholder="Search location…" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Pickup Points</Label>
            {mpuGroups.map((g, gi) => (
              <div key={g.id} className="rounded-lg border border-border bg-muted/20 p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Input list={locationListId} value={g.location}
                    onChange={e => setGroupLocation(setMpuGroups, g.id, e.target.value)}
                    placeholder={`Pickup ${gi + 1} — from…`} required className="flex-1" />
                  {mpuGroups.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" className="size-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setMpuGroups(gs => gs.filter(x => x.id !== g.id))}>×</Button>
                  )}
                </div>
                {renderEntryRows(
                  g.entries,
                  (id, field, value) => updateGroupEntry(setMpuGroups, g.id, id, field, value),
                  (id) => removeGroupEntry(setMpuGroups, g.id, id),
                  () => addGroupEntry(setMpuGroups, g.id)
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setMpuGroups(gs => [...gs, newGroup()])}>
              + Add Pickup Location
            </Button>
          </div>
        </div>
      )}

      {/* ── MULTI-DROPOFF ────────────────────────────────────────────── */}
      {type === 'multi-dropoff' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Common Origin (From)</Label>
            <Input list={locationListId} value={mdoFrom} onChange={e => setMdoFrom(e.target.value)}
              placeholder="Search location…" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Destinations</Label>
            {mdoGroups.map((g, gi) => (
              <div key={g.id} className="rounded-lg border border-border bg-muted/20 p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Input list={locationListId} value={g.location}
                    onChange={e => setGroupLocation(setMdoGroups, g.id, e.target.value)}
                    placeholder={`Destination ${gi + 1} — to…`} required className="flex-1" />
                  {mdoGroups.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" className="size-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setMdoGroups(gs => gs.filter(x => x.id !== g.id))}>×</Button>
                  )}
                </div>
                {renderEntryRows(
                  g.entries,
                  (id, field, value) => updateGroupEntry(setMdoGroups, g.id, id, field, value),
                  (id) => removeGroupEntry(setMdoGroups, g.id, id),
                  () => addGroupEntry(setMdoGroups, g.id)
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setMdoGroups(gs => [...gs, newGroup()])}>
              + Add Destination
            </Button>
          </div>
        </div>
      )}

      {/* Reward */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reward">Contract Reward (aUEC)</Label>
        <Input id="reward" type="number" value={reward} onChange={e => setReward(e.target.value)}
          min="0" required placeholder="0" />
      </div>

      <Button type="submit" className="w-full">Add Contract</Button>
    </form>
  );
}
