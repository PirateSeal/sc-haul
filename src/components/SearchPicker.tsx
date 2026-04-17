"use client"

import { useEffect, useState, useSyncExternalStore } from 'react'
import { CheckIcon, ChevronDownIcon, XIcon } from 'lucide-react'
import { type VariantProps } from 'class-variance-authority'
import { normalizeLocationName, cn } from '@/lib/utils'
import { Badge, badgeVariants } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type BadgeVariant = VariantProps<typeof badgeVariants>['variant']

export interface SearchPickerBadge {
  label: string
  variant?: BadgeVariant
}

export interface SearchPickerOption {
  id: string
  label: string
  meta?: string
  keywords?: string[]
  badges?: SearchPickerBadge[]
}

interface SearchPickerProps {
  title: string
  placeholder: string
  searchPlaceholder: string
  emptyMessage: string
  options: SearchPickerOption[]
  selectedOption: SearchPickerOption | null
  onSelect: (option: SearchPickerOption | null) => void
  allowClear?: boolean
  clearLabel?: string
  invalid?: boolean
  disabled?: boolean
  triggerClassName?: string
  contentClassName?: string
}

function useIsDesktop(breakpoint = '(min-width: 768px)') {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return () => {}
      }

      const mediaQuery = window.matchMedia(breakpoint)
      const handleChange = () => onStoreChange()
      mediaQuery.addEventListener('change', handleChange)

      return () => mediaQuery.removeEventListener('change', handleChange)
    },
    () =>
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia(breakpoint).matches
        : false,
    () => false
  )
}

function normalizeSearchValue(value: string) {
  return normalizeLocationName(value)
}

function SearchPickerSummary({
  option,
  placeholder,
}: {
  option: SearchPickerOption | null
  placeholder: string
}) {
  if (!option) {
    return <span className="truncate text-sm text-muted-foreground">{placeholder}</span>
  }

  return (
    <span className="flex min-w-0 flex-col items-start gap-1">
      <span className="w-full truncate text-sm text-foreground">{option.label}</span>
      {(option.meta || option.badges?.length) && (
        <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {option.meta && <span className="truncate">{option.meta}</span>}
          {option.badges?.map((badge) => (
            <Badge
              key={`${option.id}-${badge.label}`}
              variant={badge.variant ?? 'outline'}
              className="rounded-full"
            >
              {badge.label}
            </Badge>
          ))}
        </span>
      )}
    </span>
  )
}

function SearchPickerList({
  options,
  selectedOption,
  searchPlaceholder,
  emptyMessage,
  onSelect,
}: {
  options: SearchPickerOption[]
  selectedOption: SearchPickerOption | null
  searchPlaceholder: string
  emptyMessage: string
  onSelect: (option: SearchPickerOption) => void
}) {
  const [search, setSearch] = useState('')

  return (
    <Command
      shouldFilter
      filter={(value, query, keywords) => {
        const needle = normalizeSearchValue(query)
        if (!needle) return 1

        const haystacks = [value, ...(keywords ?? [])]
          .map(normalizeSearchValue)
          .filter(Boolean)

        return haystacks.some((item) => item.includes(needle)) ? 1 : 0
      }}
      className="rounded-[1.5rem] p-0"
    >
      <CommandInput
        autoFocus
        value={search}
        onValueChange={setSearch}
        placeholder={searchPlaceholder}
      />
      <CommandList className="max-h-80">
        <CommandEmpty>{emptyMessage}</CommandEmpty>
        <CommandGroup>
          {options.map((option) => {
            const isSelected = selectedOption?.id === option.id
            const searchValue = [option.label, option.meta ?? ''].join(' ').trim()

            return (
              <CommandItem
                key={option.id}
                value={searchValue}
                keywords={option.keywords}
                data-checked={isSelected}
                onSelect={() => onSelect(option)}
                className="items-start gap-3 py-2.5"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-sm font-medium">{option.label}</span>
                  {(option.meta || option.badges?.length) && (
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {option.meta && <span className="truncate">{option.meta}</span>}
                      {option.badges?.map((badge) => (
                        <Badge
                          key={`${option.id}-${badge.label}`}
                          variant={badge.variant ?? 'outline'}
                          className="rounded-full"
                        >
                          {badge.label}
                        </Badge>
                      ))}
                    </span>
                  )}
                </span>
                {isSelected && <CheckIcon className="mt-0.5 opacity-100" />}
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}

export function SearchPicker({
  title,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  options,
  selectedOption,
  onSelect,
  allowClear = false,
  clearLabel = 'Clear selection',
  invalid = false,
  disabled = false,
  triggerClassName,
  contentClassName,
}: SearchPickerProps) {
  const isDesktop = useIsDesktop()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  const trigger = (
    <div className="relative w-full">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-label={title}
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        className={cn(
          'h-auto min-h-10 w-full justify-between rounded-3xl px-3 py-2 text-left font-normal',
          'focus-visible:ring-3',
          triggerClassName
        )}
      >
        <SearchPickerSummary option={selectedOption} placeholder={placeholder} />
        <ChevronDownIcon data-icon="inline-end" className="shrink-0 text-muted-foreground" />
      </Button>
      {allowClear && selectedOption && !disabled && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={clearLabel}
          className="absolute top-1/2 right-8 -translate-y-1/2"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onSelect(null)
          }}
        >
          <XIcon />
        </Button>
      )}
    </div>
  )

  const list = (
    <SearchPickerList
      key={`${open ? 'open' : 'closed'}-${selectedOption?.id ?? 'empty'}`}
      options={options}
      selectedOption={selectedOption}
      searchPlaceholder={searchPlaceholder}
      emptyMessage={emptyMessage}
      onSelect={(option) => {
        onSelect(option)
        setOpen(false)
      }}
    />
  )

  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={8}
          className={cn('w-[var(--radix-popover-trigger-width)] p-0', contentClassName)}
        >
          {list}
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <>
      <div
        onClick={() => {
          if (!disabled) {
            setOpen(true)
          }
        }}
      >
        {trigger}
      </div>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className={cn('gap-0 p-0 pb-2', contentClassName)}>
          <DrawerHeader className="sr-only">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{searchPlaceholder}</DrawerDescription>
          </DrawerHeader>
          {list}
        </DrawerContent>
      </Drawer>
    </>
  )
}
