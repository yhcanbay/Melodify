import ReactDOM from 'react-dom/client'
import melodifyIcon from '../../public/melodify-icon.svg'
import './mobile.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <main className="mobile-welcome">
    <img src={melodifyIcon} alt="" width="96" height="96" />
    <h1>Melodify</h1>
    <p>Mobil deneyim yakında.</p>
  </main>,
)
