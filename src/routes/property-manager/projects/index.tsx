import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/property-manager/projects/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/property-manager/projects/"!</div>
}
