'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Plus, Loader2 } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command'
import { createCategory } from '@/app/actions/products'
import type { Category } from '@/lib/db/schema'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CategorySelectProps {
  categories: Category[]
  value: string            // selected category id ('' = none)
  onChange: (id: string, updatedList: Category[]) => void
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function CategorySelect({ categories, value, onChange }: CategorySelectProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [localCategories, setLocalCategories] = React.useState<Category[]>(categories)
  const [creating, setCreating] = React.useState(false)
  const [justCreated, setJustCreated] = React.useState<string | null>(null)

  // Keep local list in sync when parent updates categories (e.g. re-render after refresh)
  React.useEffect(() => {
    setLocalCategories(categories)
  }, [categories])

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const trimmed = search.trim()

  const filtered = React.useMemo(
    () =>
      trimmed
        ? localCategories.filter((c) =>
            c.name.toLowerCase().includes(trimmed.toLowerCase())
          )
        : localCategories,
    [localCategories, trimmed]
  )

  const exactMatch = localCategories.some(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase()
  )

  const showCreateOption = trimmed.length > 0 && !exactMatch

  const selectedName = localCategories.find((c) => c.id === value)?.name

  // ─── Handlers ────────────────────────────────────────────────────────────────

  function handleSelect(categoryId: string) {
    onChange(categoryId, localCategories)
    setOpen(false)
    setSearch('')
  }

  function handleClear() {
    onChange('', localCategories)
    setOpen(false)
    setSearch('')
  }

  async function handleCreate() {
    if (!trimmed || creating) return
    setCreating(true)
    try {
      const result = await createCategory(trimmed)
      if (!result.success) return
      const newCat = result.data as Category
      const updated = [...localCategories, newCat]
      setLocalCategories(updated)
      onChange(newCat.id, updated)
      setJustCreated(newCat.id)
      setTimeout(() => setJustCreated(null), 2000)
      setOpen(false)
      setSearch('')
    } finally {
      setCreating(false)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* Trigger */}
      <PopoverTrigger
        className={[
          'flex w-full items-center justify-between h-10 rounded-lg px-3 text-sm outline-none transition-all',
          'border',
          open ? 'border-[var(--accent-primary)] ring-2 ring-[rgba(245,97,10,0.2)]' : 'border-[var(--border)]',
        ].join(' ')}
        style={{
          background: 'var(--bg-input)',
          color: selectedName ? 'var(--text-primary)' : 'var(--text-muted)',
        }}
      >
        <span className="truncate">
          {selectedName ?? 'Select or create category'}
        </span>
        <ChevronsUpDown size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </PopoverTrigger>

      {/* Dropdown */}
      <PopoverContent
        align="start"
        sideOffset={6}
        className="p-0 w-[--radix-popover-trigger-width]"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          width: 'var(--radix-popover-trigger-width, 320px)',
          minWidth: '240px',
        }}
      >
        <Command shouldFilter={false}>
          {/* Search input */}
          <CommandInput
            placeholder="Search or create…"
            value={search}
            onValueChange={setSearch}
            style={{ background: 'var(--bg-input)' }}
          />

          <CommandList>
            {/* Clear / no category option */}
            {value && (
              <>
                <CommandGroup>
                  <CommandItem
                    value="__clear__"
                    onSelect={handleClear}
                    className="text-[var(--text-muted)] italic"
                  >
                    No category
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {/* Existing categories */}
            <CommandGroup>
              {filtered.length === 0 && !showCreateOption && (
                <CommandEmpty>No categories found.</CommandEmpty>
              )}
              {filtered.map((cat) => (
                <CommandItem
                  key={cat.id}
                  value={cat.id}
                  onSelect={() => handleSelect(cat.id)}
                >
                  {/* Checkmark for selected */}
                  <span
                    className="flex items-center justify-center w-4 h-4 shrink-0"
                    style={{
                      color: cat.id === value ? 'var(--accent-primary)' : 'transparent',
                    }}
                  >
                    <Check size={13} />
                  </span>
                  <span className="flex-1">{cat.name}</span>
                  {/* "just created" flash */}
                  {justCreated === cat.id && (
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                      style={{
                        background: 'var(--positive-bg)',
                        color: 'var(--positive)',
                      }}
                    >
                      created
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>

            {/* Create new option */}
            {showCreateOption && (
              <>
                {filtered.length > 0 && <CommandSeparator />}
                <CommandGroup>
                  <CommandItem
                    value="__create__"
                    onSelect={handleCreate}
                    disabled={creating}
                    className="font-medium"
                    style={{ color: 'var(--accent-primary)' }}
                  >
                    {creating ? (
                      <Loader2 size={13} className="animate-spin shrink-0" />
                    ) : (
                      <Plus size={13} className="shrink-0" />
                    )}
                    <span>
                      {creating ? 'Creating…' : `Create "${trimmed}"`}
                    </span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
