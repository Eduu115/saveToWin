import { useEffect, useState } from 'react'

export function App() {
  const [health, setHealth] = useState('…')

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((data) => setHealth(JSON.stringify(data)))
      .catch((err) => setHealth(String(err)))
  }, [])

  return (
    <>
      <h1>saveToWin</h1>
      <p>/api/health → {health}</p>
    </>
  )
}
