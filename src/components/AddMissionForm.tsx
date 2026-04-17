import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { MinusIcon, PlusIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { getCachedCommodities } from '@/services/db';
import type { Commodity } from '@/services/db';
import type { LocationSearchOption } from '@/services/searchable-locations';
import type { MissionType, MissionCommodity, CargoEntry } from '@/store/useHaulStore';
import { useHaulStore } from '@/store/useHaulStore';
import { SearchPicker, type SearchPickerOption } from '@/components/SearchPicker';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from '@/components/ui/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type CommodityOption = SearchPickerOption & {
  commodity: MissionCommodity;
};

type EntryRow = { id: string; commodity: CommodityOption | null; scu: string };
type LocationGroup = { id: string; location: LocationSearchOption | null; entries: EntryRow[] };

const uid = () => Math.random().toString(36).slice(2, 9);
const newEntry = (): EntryRow => ({ id: uid(), commodity: null, scu: '' });
const newGroup = (): LocationGroup => ({ id: uid(), location: null, entries: [newEntry()] });

function hasPositiveScu(value: string) {
  return (parseInt(value, 10) || 0) > 0;
}

function sanitizeNumericInput(value: string) {
  return value.replace(/\D/g, '');
}

function parseNumericInput(value: string) {
  return parseInt(value, 10) || 0;
}

function stepNumericInput(value: string, delta: number, min = 0) {
  return String(Math.max(min, parseNumericInput(value) + delta));
}

function NumericStepperField({
  id,
  value,
  onChange,
  step = 1,
  min = 0,
  placeholder,
  unit,
  invalid,
  ariaLabel,
  required,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  step?: number;
  min?: number;
  placeholder?: string;
  unit: string;
  invalid?: boolean;
  ariaLabel: string;
  required?: boolean;
}) {
  const numericValue = parseNumericInput(value);
  const canDecrement = numericValue > min;

  return (
    <InputGroup>
      <InputGroupInput
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(event) => onChange(sanitizeNumericInput(event.target.value))}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-label={ariaLabel}
        required={required}
        className="text-right tabular-nums"
      />
      <InputGroupAddon align="inline-start">
        <InputGroupButton
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => onChange(stepNumericInput(value, -step, min))}
          disabled={!canDecrement}
          aria-label={`Decrease ${ariaLabel}`}
          className="text-muted-foreground hover:text-foreground"
        >
          <MinusIcon />
        </InputGroupButton>
      </InputGroupAddon>
      <InputGroupAddon align="inline-end">
        <InputGroupText className="font-medium">{unit}</InputGroupText>
        <InputGroupButton
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => onChange(stepNumericInput(value, step, min))}
          aria-label={`Increase ${ariaLabel}`}
          className="text-muted-foreground hover:text-foreground"
        >
          <PlusIcon />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}

function toCommodityOption(commodity: Commodity): CommodityOption {
  return {
    id: `commodity:${commodity.id}`,
    label: commodity.name,
    meta: [commodity.kind, commodity.code].filter(Boolean).join(' · '),
    keywords: [commodity.name, commodity.code, commodity.kind ?? ''].filter(Boolean),
    badges: commodity.is_illegal === 1 ? [{ label: 'Illegal', variant: 'destructive' }] : undefined,
    commodity: {
      id: commodity.id,
      name: commodity.name,
      code: commodity.code,
      kind: commodity.kind ?? '',
      isIllegal: commodity.is_illegal === 1,
    },
  };
}

function toLocationPickerOption(location: LocationSearchOption): SearchPickerOption {
  return {
    id: `location:${location.id}`,
    label: location.displayName,
    meta: location.system,
    keywords: location.searchTerms,
    badges:
      location.source === 'uex-fallback'
        ? [{ label: 'Approx', variant: 'outline' }]
        : undefined,
  };
}

function CargoEntryRow({
  entry,
  commodities,
  submitted,
  onCommodityChange,
  onScuChange,
  onRemove,
  canRemove,
}: {
  entry: EntryRow;
  commodities: CommodityOption[];
  submitted: boolean;
  onCommodityChange: (commodity: CommodityOption | null) => void;
  onScuChange: (value: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const commodityInvalid = submitted && !entry.commodity;
  const scuInvalid = submitted && !hasPositiveScu(entry.scu);

  return (
    <Field data-invalid={commodityInvalid || scuInvalid || undefined} className="gap-1.5">
      <FieldLabel className="sr-only">Cargo line</FieldLabel>
      <FieldContent>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <SearchPicker
              title="Commodity"
              placeholder="Select commodity"
              searchPlaceholder="Search commodity…"
              emptyMessage="No commodity matches that search."
              options={commodities}
              selectedOption={entry.commodity}
              onSelect={(option) => onCommodityChange(option ? commodities.find((item) => item.id === option.id) ?? null : null)}
              invalid={commodityInvalid}
            />
          </div>
          <div className="w-40 shrink-0">
            <NumericStepperField
              value={entry.scu}
              onChange={onScuChange}
              min={1}
              placeholder="16"
              unit="SCU"
              invalid={scuInvalid}
              ariaLabel="SCU amount"
            />
          </div>
          {canRemove && (
            <InputGroupButton
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onRemove}
              className="mt-1 text-muted-foreground hover:text-destructive"
              aria-label="Remove cargo row"
            >
              <XIcon />
            </InputGroupButton>
          )}
        </div>
        {(commodityInvalid || scuInvalid) && (
          <FieldDescription className="text-destructive">
            {commodityInvalid
              ? 'Select a commodity.'
              : 'Enter an SCU amount greater than 0.'}
          </FieldDescription>
        )}
      </FieldContent>
    </Field>
  );
}

export function AddMissionForm({
  locationOptions,
  onClose,
}: {
  locationOptions: LocationSearchOption[];
  onClose?: () => void;
}) {
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [type, setType] = useState<MissionType>('direct');
  const [reward, setReward] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const [directFrom, setDirectFrom] = useState<LocationSearchOption | null>(null);
  const [directTo, setDirectTo] = useState<LocationSearchOption | null>(null);
  const [directEntries, setDirectEntries] = useState<EntryRow[]>([newEntry()]);

  const [mpuTo, setMpuTo] = useState<LocationSearchOption | null>(null);
  const [mpuGroups, setMpuGroups] = useState<LocationGroup[]>([newGroup()]);

  const [mdoFrom, setMdoFrom] = useState<LocationSearchOption | null>(null);
  const [mdoGroups, setMdoGroups] = useState<LocationGroup[]>([newGroup()]);

  const addMission = useHaulStore((state) => state.addMission);

  useEffect(() => {
    async function loadData() {
      try {
        setCommodities(await getCachedCommodities());
      } catch {
        // Non-fatal. The picker will simply render without options.
      }
    }

    loadData();
  }, []);

  const commodityOptions = useMemo(
    () => commodities.map(toCommodityOption),
    [commodities]
  );
  const locationPickerOptions = useMemo(
    () => locationOptions.map(toLocationPickerOption),
    [locationOptions]
  );

  const commodityById = useMemo(
    () => new Map(commodityOptions.map((option) => [option.id, option])),
    [commodityOptions]
  );
  const locationById = useMemo(
    () => new Map(locationOptions.map((option) => [`location:${option.id}`, option])),
    [locationOptions]
  );

  function updateEntry(
    setEntries: Dispatch<SetStateAction<EntryRow[]>>,
    entryId: string,
    updater: (entry: EntryRow) => EntryRow
  ) {
    setEntries((entries) =>
      entries.map((entry) => (entry.id === entryId ? updater(entry) : entry))
    );
  }

  function updateGroupEntry(
    setGroups: Dispatch<SetStateAction<LocationGroup[]>>,
    groupId: string,
    entryId: string,
    updater: (entry: EntryRow) => EntryRow
  ) {
    setGroups((groups) =>
      groups.map((group) =>
        group.id !== groupId
          ? group
          : {
              ...group,
              entries: group.entries.map((entry) =>
                entry.id === entryId ? updater(entry) : entry
              ),
            }
      )
    );
  }

  function removeGroupEntry(
    setGroups: Dispatch<SetStateAction<LocationGroup[]>>,
    groupId: string,
    entryId: string
  ) {
    setGroups((groups) =>
      groups.map((group) =>
        group.id !== groupId
          ? group
          : {
              ...group,
              entries: group.entries.filter((entry) => entry.id !== entryId),
            }
      )
    );
  }

  function addGroupEntry(
    setGroups: Dispatch<SetStateAction<LocationGroup[]>>,
    groupId: string
  ) {
    setGroups((groups) =>
      groups.map((group) =>
        group.id !== groupId
          ? group
          : {
              ...group,
              entries: [...group.entries, newEntry()],
            }
      )
    );
  }

  function validateEntries(entries: EntryRow[], label: string) {
    const missingCommodityIndex = entries.findIndex((entry) => !entry.commodity);
    if (missingCommodityIndex >= 0) {
      alert(`Select a commodity for ${label} cargo row ${missingCommodityIndex + 1}.`);
      return false;
    }

    const invalidScuIndex = entries.findIndex((entry) => !hasPositiveScu(entry.scu));
    if (invalidScuIndex >= 0) {
      alert(`Enter an SCU amount greater than 0 for ${label} cargo row ${invalidScuIndex + 1}.`);
      return false;
    }

    return true;
  }

  function selectedLocationOption(location: LocationSearchOption | null) {
    return location ? locationPickerOptions.find((option) => option.id === `location:${location.id}`) ?? null : null;
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);

    let cargoEntries: CargoEntry[] = [];
    const fallbackLocations = new Set<string>();

    if (type === 'direct') {
      if (!directFrom) {
        alert('Select a pickup location.');
        return;
      }
      if (!directTo) {
        alert('Select a dropoff location.');
        return;
      }
      if (!validateEntries(directEntries, 'direct')) return;

      if (directFrom.source === 'uex-fallback') fallbackLocations.add(directFrom.displayName);
      if (directTo.source === 'uex-fallback') fallbackLocations.add(directTo.displayName);

      cargoEntries = directEntries.map((entry) => ({
        id: entry.id,
        scu: parseInt(entry.scu, 10) || 0,
        pickupLocationName: directFrom.displayName,
        dropoffLocationName: directTo.displayName,
        commodity: entry.commodity?.commodity,
      }));
    } else if (type === 'multi-pickup') {
      if (!mpuTo) {
        alert('Select a common destination.');
        return;
      }
      if (mpuTo.source === 'uex-fallback') fallbackLocations.add(mpuTo.displayName);

      for (let index = 0; index < mpuGroups.length; index += 1) {
        const group = mpuGroups[index];
        if (!group.location) {
          alert(`Select pickup location ${index + 1}.`);
          return;
        }
        if (!validateEntries(group.entries, `pickup location ${index + 1}`)) return;
        if (group.location.source === 'uex-fallback') {
          fallbackLocations.add(group.location.displayName);
        }

        group.entries.forEach((entry) =>
          cargoEntries.push({
            id: entry.id,
            scu: parseInt(entry.scu, 10) || 0,
            pickupLocationName: group.location!.displayName,
            dropoffLocationName: mpuTo.displayName,
            commodity: entry.commodity?.commodity,
          })
        );
      }
    } else {
      if (!mdoFrom) {
        alert('Select a common origin.');
        return;
      }
      if (mdoFrom.source === 'uex-fallback') fallbackLocations.add(mdoFrom.displayName);

      for (let index = 0; index < mdoGroups.length; index += 1) {
        const group = mdoGroups[index];
        if (!group.location) {
          alert(`Select destination ${index + 1}.`);
          return;
        }
        if (!validateEntries(group.entries, `destination ${index + 1}`)) return;
        if (group.location.source === 'uex-fallback') {
          fallbackLocations.add(group.location.displayName);
        }

        group.entries.forEach((entry) =>
          cargoEntries.push({
            id: entry.id,
            scu: parseInt(entry.scu, 10) || 0,
            pickupLocationName: mdoFrom.displayName,
            dropoffLocationName: group.location!.displayName,
            commodity: entry.commodity?.commodity,
          })
        );
      }
    }

    if (cargoEntries.length === 0 || cargoEntries.every((entry) => entry.scu <= 0)) {
      alert('Add at least one cargo entry with an SCU amount.');
      return;
    }

    const totalScu = cargoEntries.reduce((sum, entry) => sum + entry.scu, 0);
    addMission({
      id: uid(),
      type,
      cargoEntries,
      reward: parseInt(reward, 10) || 0,
    });

    toast.success('Contract added', {
      description: `${totalScu} SCU · ${(parseInt(reward, 10) || 0).toLocaleString()} aUEC`,
    });

    if (fallbackLocations.size > 0) {
      toast.message('Approximate UEX fallback coordinates in use', {
        description: [...fallbackLocations].join(', '),
      });
    }

    if (onClose) onClose();
  };

  function renderEntryRows(
    entries: EntryRow[],
    onCommodityChange: (id: string, commodity: CommodityOption | null) => void,
    onScuChange: (id: string, value: string) => void,
    onRemove: (id: string) => void,
    onAdd: () => void
  ) {
    return (
      <FieldGroup className="gap-3">
        <Field>
          <FieldTitle className="text-xs uppercase tracking-wider text-muted-foreground">
            Cargo
          </FieldTitle>
          <FieldDescription>
            Select the contract commodities and the SCU assigned to each cargo line.
          </FieldDescription>
        </Field>
        {entries.map((entry) => (
          <CargoEntryRow
            key={entry.id}
            entry={entry}
            commodities={commodityOptions}
            submitted={submitted}
            onCommodityChange={(commodity) => onCommodityChange(entry.id, commodity)}
            onScuChange={(value) => onScuChange(entry.id, value)}
            onRemove={() => onRemove(entry.id)}
            canRemove={entries.length > 1}
          />
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start text-xs text-muted-foreground"
          onClick={onAdd}
        >
          <PlusIcon data-icon="inline-start" />
          Add cargo type
        </Button>
      </FieldGroup>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl border border-border bg-muted/30 p-4">
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel>Mission Type</FieldLabel>
          <Select value={type} onValueChange={(value: MissionType) => setType(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="direct">Direct — one pickup → one dropoff</SelectItem>
              <SelectItem value="multi-pickup">Multi-Pickup — many pickups → one dropoff</SelectItem>
              <SelectItem value="multi-dropoff">Multi-Dropoff — one pickup → many dropoffs</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        {type === 'direct' && (
          <div className="grid gap-3 md:grid-cols-2">
            <Field data-invalid={submitted && !directFrom ? true : undefined}>
              <FieldLabel className="text-xs text-muted-foreground">Pickup (From)</FieldLabel>
              <SearchPicker
                title="Pickup location"
                placeholder="Search location…"
                searchPlaceholder="Search pickup location…"
                emptyMessage="No location matches that search."
                options={locationPickerOptions}
                selectedOption={selectedLocationOption(directFrom)}
                onSelect={(option) => setDirectFrom(option ? locationById.get(option.id) ?? null : null)}
                invalid={submitted && !directFrom}
              />
            </Field>
            <Field data-invalid={submitted && !directTo ? true : undefined}>
              <FieldLabel className="text-xs text-muted-foreground">Dropoff (To)</FieldLabel>
              <SearchPicker
                title="Dropoff location"
                placeholder="Search location…"
                searchPlaceholder="Search dropoff location…"
                emptyMessage="No location matches that search."
                options={locationPickerOptions}
                selectedOption={selectedLocationOption(directTo)}
                onSelect={(option) => setDirectTo(option ? locationById.get(option.id) ?? null : null)}
                invalid={submitted && !directTo}
              />
            </Field>
          </div>
        )}

        {type === 'direct' &&
          renderEntryRows(
            directEntries,
            (entryId, commodity) =>
              updateEntry(setDirectEntries, entryId, (entry) => ({ ...entry, commodity })),
            (entryId, value) =>
              updateEntry(setDirectEntries, entryId, (entry) => ({ ...entry, scu: value })),
            (entryId) =>
              setDirectEntries((entries) => entries.filter((entry) => entry.id !== entryId)),
            () => setDirectEntries((entries) => [...entries, newEntry()])
          )}

        {type === 'multi-pickup' && (
          <FieldGroup className="gap-3">
            <Field data-invalid={submitted && !mpuTo ? true : undefined}>
              <FieldLabel className="text-xs text-muted-foreground">Common Destination (To)</FieldLabel>
              <SearchPicker
                title="Common destination"
                placeholder="Search location…"
                searchPlaceholder="Search destination…"
                emptyMessage="No location matches that search."
                options={locationPickerOptions}
                selectedOption={selectedLocationOption(mpuTo)}
                onSelect={(option) => setMpuTo(option ? locationById.get(option.id) ?? null : null)}
                invalid={submitted && !mpuTo}
              />
            </Field>

            <Field>
              <FieldTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                Pickup Points
              </FieldTitle>
              <FieldDescription>Each pickup location can carry one or many commodities.</FieldDescription>
            </Field>

            {mpuGroups.map((group, groupIndex) => (
              <div key={group.id} className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <Field data-invalid={submitted && !group.location ? true : undefined}>
                      <FieldLabel className="text-xs text-muted-foreground">
                        Pickup {groupIndex + 1}
                      </FieldLabel>
                      <SearchPicker
                        title={`Pickup ${groupIndex + 1}`}
                        placeholder="Search location…"
                        searchPlaceholder={`Search pickup ${groupIndex + 1}…`}
                        emptyMessage="No location matches that search."
                        options={locationPickerOptions}
                        selectedOption={selectedLocationOption(group.location)}
                        onSelect={(option) =>
                          setMpuGroups((groups) =>
                            groups.map((current) =>
                              current.id !== group.id
                                ? current
                                : {
                                    ...current,
                                    location: option ? locationById.get(option.id) ?? null : null,
                                  }
                            )
                          )
                        }
                        invalid={submitted && !group.location}
                      />
                    </Field>
                  </div>
                  {mpuGroups.length > 1 && (
                    <InputGroupButton
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setMpuGroups((groups) => groups.filter((current) => current.id !== group.id))}
                      className="mt-6 text-muted-foreground hover:text-destructive"
                      aria-label={`Remove pickup ${groupIndex + 1}`}
                    >
                      <XIcon />
                    </InputGroupButton>
                  )}
                </div>
                {renderEntryRows(
                  group.entries,
                  (entryId, commodity) =>
                    updateGroupEntry(setMpuGroups, group.id, entryId, (entry) => ({
                      ...entry,
                      commodity: commodity ? commodityById.get(commodity.id) ?? commodity : null,
                    })),
                  (entryId, value) =>
                    updateGroupEntry(setMpuGroups, group.id, entryId, (entry) => ({
                      ...entry,
                      scu: value,
                    })),
                  (entryId) => removeGroupEntry(setMpuGroups, group.id, entryId),
                  () => addGroupEntry(setMpuGroups, group.id)
                )}
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMpuGroups((groups) => [...groups, newGroup()])}
            >
              <PlusIcon data-icon="inline-start" />
              Add Pickup Location
            </Button>
          </FieldGroup>
        )}

        {type === 'multi-dropoff' && (
          <FieldGroup className="gap-3">
            <Field data-invalid={submitted && !mdoFrom ? true : undefined}>
              <FieldLabel className="text-xs text-muted-foreground">Common Origin (From)</FieldLabel>
              <SearchPicker
                title="Common origin"
                placeholder="Search location…"
                searchPlaceholder="Search origin…"
                emptyMessage="No location matches that search."
                options={locationPickerOptions}
                selectedOption={selectedLocationOption(mdoFrom)}
                onSelect={(option) => setMdoFrom(option ? locationById.get(option.id) ?? null : null)}
                invalid={submitted && !mdoFrom}
              />
            </Field>

            <Field>
              <FieldTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                Destinations
              </FieldTitle>
              <FieldDescription>Each destination can receive one or many commodities.</FieldDescription>
            </Field>

            {mdoGroups.map((group, groupIndex) => (
              <div key={group.id} className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <Field data-invalid={submitted && !group.location ? true : undefined}>
                      <FieldLabel className="text-xs text-muted-foreground">
                        Destination {groupIndex + 1}
                      </FieldLabel>
                      <SearchPicker
                        title={`Destination ${groupIndex + 1}`}
                        placeholder="Search location…"
                        searchPlaceholder={`Search destination ${groupIndex + 1}…`}
                        emptyMessage="No location matches that search."
                        options={locationPickerOptions}
                        selectedOption={selectedLocationOption(group.location)}
                        onSelect={(option) =>
                          setMdoGroups((groups) =>
                            groups.map((current) =>
                              current.id !== group.id
                                ? current
                                : {
                                    ...current,
                                    location: option ? locationById.get(option.id) ?? null : null,
                                  }
                            )
                          )
                        }
                        invalid={submitted && !group.location}
                      />
                    </Field>
                  </div>
                  {mdoGroups.length > 1 && (
                    <InputGroupButton
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setMdoGroups((groups) => groups.filter((current) => current.id !== group.id))}
                      className="mt-6 text-muted-foreground hover:text-destructive"
                      aria-label={`Remove destination ${groupIndex + 1}`}
                    >
                      <XIcon />
                    </InputGroupButton>
                  )}
                </div>
                {renderEntryRows(
                  group.entries,
                  (entryId, commodity) =>
                    updateGroupEntry(setMdoGroups, group.id, entryId, (entry) => ({
                      ...entry,
                      commodity: commodity ? commodityById.get(commodity.id) ?? commodity : null,
                    })),
                  (entryId, value) =>
                    updateGroupEntry(setMdoGroups, group.id, entryId, (entry) => ({
                      ...entry,
                      scu: value,
                    })),
                  (entryId) => removeGroupEntry(setMdoGroups, group.id, entryId),
                  () => addGroupEntry(setMdoGroups, group.id)
                )}
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMdoGroups((groups) => [...groups, newGroup()])}
            >
              <PlusIcon data-icon="inline-start" />
              Add Destination
            </Button>
          </FieldGroup>
        )}

        <Field>
          <FieldLabel htmlFor="reward">Contract Reward (aUEC)</FieldLabel>
          <NumericStepperField
            id="reward"
            value={reward}
            onChange={setReward}
            step={1000}
            placeholder="45,000"
            unit="aUEC"
            ariaLabel="Contract Reward (aUEC)"
            required
          />
        </Field>
      </FieldGroup>

      <Button type="submit" className="w-full">
        Add Contract
      </Button>
    </form>
  );
}
