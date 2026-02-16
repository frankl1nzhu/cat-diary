import { NavLink } from 'react-router-dom'
import './BottomNav.css'

const navItems = [
    { to: '/', icon: '🏠', label: '首页' },
    { to: '/log', icon: '📝', label: '记录' },
    { to: '/stats', icon: '📊', label: '统计' },
    { to: '/settings', icon: '⚙️', label: '设置' },
]

export function BottomNav() {
    return (
        <nav className="bottom-nav" id="bottom-nav">
            {navItems.map((item) => (
                <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                        `bottom-nav-item ${isActive ? 'bottom-nav-item-active' : ''}`
                    }
                >
                    <span className="bottom-nav-icon">{item.icon}</span>
                    <span className="bottom-nav-label">{item.label}</span>
                </NavLink>
            ))}
        </nav>
    )
}
