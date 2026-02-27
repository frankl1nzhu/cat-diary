import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { CatSwitcher } from './CatSwitcher'
import './AppLayout.css'

export function AppLayout() {
    return (
        <div className="app-layout">
            <CatSwitcher />
            <main className="app-main safe-area-padding safe-area-padding-bottom scroll-area">
                <Outlet />
            </main>
            <BottomNav />
        </div>
    )
}
