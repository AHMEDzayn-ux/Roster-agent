import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { extractErrorMessage } from '../../../api/client'
import { createSkill, deleteSkill, listSkills } from '../../../api/endpoints'
import { Button, Card, EmptyState, ErrorBanner, Input, LoadingText } from '../../../components/ui'

export default function SkillsConfig() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['skills'], queryFn: listSkills })
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div>
      <Card className="mb-5">
        <h2 className="mb-3 font-medium text-slate-800">Add a skill</h2>
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
      </Card>

      {query.isLoading && <LoadingText />}
      {query.data && query.data.length === 0 && <EmptyState text="No skills configured yet." />}
      {query.data && query.data.length > 0 && (
        <div className="space-y-2">
          {query.data.map((s) => (
            <Card key={s.id} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-800">{s.name}</p>
                {s.description && <p className="text-sm text-slate-500">{s.description}</p>}
              </div>
              <Button variant="danger" onClick={() => deleteMutation.mutate(s.id)}>
                Delete
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
