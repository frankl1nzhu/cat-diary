import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import './AppLayout.css'

export function AppLayout() {
    return (
        <div className="app-layout">
            <main className="app-main safe-area-padding safe-area-padding-bottom scroll-area">
                <Outlet />
            </main>
            <BottomNav />
        </div>
    )
}
