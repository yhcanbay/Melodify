import ReactDOM from 'react-dom/client'
import { StrictMode } from 'react'
import { applyAppearance, readAppearance } from '../../src/shared/appearance'
import { MobileApp } from './app/MobileApp'
import './styles/mobile.css'

applyAppearance(readAppearance())
ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode><MobileApp /></StrictMode>,
)
