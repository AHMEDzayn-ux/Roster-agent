import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { extractErrorMessage } from '../../../api/client'
import { createSkill, deleteSkill, listSkills, updateSkill } from '../../../api/endpoints'
import type { Skill } from '../../../types'
import {
  Button,
  CellText,
  EditBar,
  EmptyState,
  ErrorBanner,
  Input,
  LoadingText,
  ScrollTable,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '../../../components/ui'

export default function SkillsConfig() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['skills'], queryFn: listSkills })
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [rows, setRows] = useState<Skill[]>([])

  useEffect(() => {
    if (!editing && query.data) setRows(query.data)
  }, [query.data, editing])

  const dirtyRows = rows.filter((r) => {
    const orig = query.data?.find((o) => o.id === r.id)
    return orig && (orig.name !== r.name || orig.description !== r.description)
  })

  const createMutation = useMutation({
    mutationFn: () => createSkill({ name, description: description || undefined }),
    onSuccess: () => {
      setName('')
      setDescription('')
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['skills'] })
    },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteSkill(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['skills'] }),
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(dirtyRows.map((r) => updateSkill(r.id, { name: r.name, description: r.description ?? undefined })))
    },
    onSuccess: () => {
      setError(null)
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['skills'] })
    },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const updateRow = (id: number, patch: Partial<Skill>) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  return (
    <div>
      <details className="mb-3 rounded-card border border-line bg-surface shadow-xs">
        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-ink">+ Add a skill</summary>
        <div className="border-t border-line p-3">
          <ErrorBanner message={error} />
          <form
            onSubmit={(e) => {
              e.preventDefault()
              createMutation.mutate()
            }}
            className="flex flex-wrap gap-2"
          >
            <Input placeholder="Name (e.g. Prepaid Sales)" required value={name} onChange={(e) => setName(e.target.value)} className="w-56" />
            <Input placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} className="w-72" />
            <Button type="submit" disabled={createMutation.isPending}>
              Add
            </Button>
          </form>
        </div>
      </details>

      {query.isLoading && <LoadingText />}
      {query.data && query.data.length === 0 && <EmptyState text="No skills configured yet." />}
      {query.data && query.data.length > 0 && (
        <>
          <ErrorBanner message={editing ? error : null} />
          <EditBar
            editing={editing}
            dirtyCount={dirtyRows.length}
            saving={saveMutation.isPending}
            onEdit={() => setEditing(true)}
            onSave={() => saveMutation.mutate()}
            onCancel={() => {
              setRows(query.data ?? [])
              setEditing(false)
              setError(null)
            }}
          />
          <ScrollTable>
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Description</Th>
                {!editing && <Th></Th>}
              </Tr>
            </Thead>
            <Tbody>
              {rows.map((s) => (
                <Tr key={s.id}>
                  <Td className="font-medium text-ink">
                    <CellText editing={editing} value={s.name} onChange={(v) => updateRow(s.id, { name: v })} />
                  </Td>
                  <Td>
                    <CellText editing={editing} value={s.description ?? ''} onChange={(v) => updateRow(s.id, { description: v || null })} />
                  </Td>
                  {!editing && (
                    <Td className="text-right">
                      <Button variant="danger" onClick={() => deleteMutation.mutate(s.id)}>
                        Delete
                      </Button>
                    </Td>
                  )}
                </Tr>
              ))}
            </Tbody>
          </ScrollTable>
        </>
      )}
    </div>
  )
}
