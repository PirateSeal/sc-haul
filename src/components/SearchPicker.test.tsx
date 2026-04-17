import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchPicker, type SearchPickerOption } from '@/components/SearchPicker';

const OPTIONS: SearchPickerOption[] = [
  {
    id: 'loc-1',
    label: 'Ambitious Dream Station',
    meta: 'Stanton',
    keywords: ['CRU-L1', 'cru l1', 'cru-l1 ambitious dream station'],
  },
  {
    id: 'loc-2',
    label: 'Baijini Point',
    meta: 'Stanton',
    keywords: ['arccorp', 'area18'],
  },
];

describe('SearchPicker', () => {
  it('opens with keyboard, closes on escape, and reopens on pointer interaction', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <SearchPicker
        title="Pickup location"
        placeholder="Search location…"
        searchPlaceholder="Search pickup location…"
        emptyMessage="No location matches."
        options={OPTIONS}
        selectedOption={null}
        onSelect={onSelect}
      />
    );

    const trigger = screen.getByRole('combobox', { name: 'Pickup location' });
    trigger.focus();
    await user.keyboard('{Enter}');

    expect(screen.getByPlaceholderText('Search pickup location…')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByPlaceholderText('Search pickup location…')).not.toBeInTheDocument();

    await user.click(trigger);
    expect(screen.getByPlaceholderText('Search pickup location…')).toBeInTheDocument();
  });

  it('filters by alias keywords and selects the canonical option', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <SearchPicker
        title="Pickup location"
        placeholder="Search location…"
        searchPlaceholder="Search pickup location…"
        emptyMessage="No location matches."
        options={OPTIONS}
        selectedOption={null}
        onSelect={onSelect}
      />
    );

    await user.click(screen.getByRole('combobox', { name: 'Pickup location' }));
    await user.type(screen.getByPlaceholderText('Search pickup location…'), 'CRU-L1');
    await user.click(screen.getByText('Ambitious Dream Station'));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'loc-1', label: 'Ambitious Dream Station' })
    );
  });
});
