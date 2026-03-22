import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { TooltipProvider } from './components/ui/tooltip.tsx'
import { SidebarProvider } from "@/components/ui/sidebar"

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SidebarProvider>
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </SidebarProvider>
  </StrictMode>,
)
