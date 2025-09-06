import { api } from '@convex/_generated/api'
import { Id } from '@convex/_generated/dataModel'
import {
  AddTodoForm,
  TodoListContainer,
  TodoList as TodoListComponent,
  TodoItem,
  TodoCompleteButton,
  TodoText,
  TodoRemoveButton,
  TodoEmptyState,
} from '@/components/server'
import { createServerFn } from '@tanstack/react-start'
import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ConvexHttpClient } from 'convex/browser'
import { getCookie } from '@tanstack/react-start/server'
import { getCookieName } from '@/lib/auth-server-utils'

const getToken = async () => {
  const sessionCookieName = `__Secure-${await getCookieName()}`
  return getCookie(sessionCookieName)
}

function setupClient(token?: string) {
  const client = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL)
  if (token) {
    client.setAuth(token)
  }
  return client
}

export const fetchTodos = createServerFn({ method: 'GET' })
  .handler(async () => {
    const token = await getToken()
    console.log(token)
    const todos = await setupClient(token).query(api.todos.get)

  // Serialize Convex Ids to strings so they're safe to send over the wire
  return todos.map(todo => ({
    ...todo,
    _id: todo._id.toString(),
    userId: todo.userId.toString(),
  }))
})

// Handle form data
export const toggleCompletedTodo = createServerFn({ method: 'POST' })
  .validator((data) => {
    if (!(data instanceof FormData)) {
      throw new Error('Invalid form data')
    }
    const id = data.get('id')
    if (!id) {
      throw new Error('Todo id is required')
    }
    return {
      id: id.toString(),
    }
  })
  .handler(async ({ data: { id } }) => {
    const token = await getToken()
    await setupClient(token).mutation(api.todos.toggle, {
      id: id as Id<'todos'>,
    })
  })

export const removeTodo = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => {
    if (!data.id) {
      throw new Error('Todo id is required')
    }
    return data
  })
  .handler(async ({ data: { id } }) => {
    const token = await getToken()
    await setupClient(token).mutation(api.todos.remove, {
      id: id as Id<'todos'>,
    })
  })

export const addTodo = createServerFn({ method: 'POST' })
  .validator((data) => {
    if (!(data instanceof FormData)) {
      throw new Error('Invalid form data')
    }
    const text = data.get('text')
    if (!text) {
      throw new Error('Todo text is required')
    }
    return {
      text: text.toString(),
    }
  })
  .handler(async ({ data: { text } }) => {
    const token = await getToken()
    await setupClient(token).mutation(api.todos.create, { text })
  })

export const TodoList = () => {
  const { data: todos } = useSuspenseQuery({
    queryKey: ['todos'],
    queryFn: () => fetchTodos(),
  })

  return (
    <TodoListContainer>
      <AddTodoForm
        onSubmit={async (event) => {
          event.preventDefault()
          const formData = new FormData(event.currentTarget)
          await addTodo({ data: formData })
          ;(event.target as HTMLFormElement).reset()
        }}
      />

      {todos.length === 0 && <TodoEmptyState />}

      <TodoListComponent>
        {todos.map((todo) => (
          <TodoItem key={todo._id}>
            <form
              onSubmit={async (event) => {
                event.preventDefault()
                const formData = new FormData(event.currentTarget)
                const response = await toggleCompletedTodo({ data: formData })
                console.log(response)
              }}
            >
              <input type="hidden" name="id" value={todo._id} />
              <TodoCompleteButton completed={todo.completed} type="submit" />
            </form>

            <TodoText text={todo.text} completed={todo.completed} />

            <TodoRemoveButton
              onClick={() => removeTodo({ data: { id: todo._id } })}
            />
          </TodoItem>
        ))}
      </TodoListComponent>
    </TodoListContainer>
  )
}
