export default function EmptyState({ title, message, variant = "default" }) {
    return (
        <div className="hk-empty">
            {variant === "documents" ? <DocsSvg /> : variant === "dashboard" ? <DashboardSvg /> : <DefaultSvg />}
            <div className="hk-empty-title">{title}</div>
            <div className="hk-empty-text">{message}</div>
        </div>
    );
}

function DefaultSvg() {
    return (
        <svg viewBox="0 0 120 120" fill="none" role="img" aria-label="Empty state illustration">
            <path d="M18 58c0-20 12-34 42-34s42 14 42 34-12 38-42 38-42-18-42-38Z" stroke="currentColor" opacity="0.25" strokeWidth="2" />
            <path d="M35 60h50" stroke="currentColor" opacity="0.45" strokeWidth="3" strokeLinecap="round" />
            <path d="M45 72h30" stroke="currentColor" opacity="0.35" strokeWidth="3" strokeLinecap="round" />
            <path d="M48 42h24" stroke="currentColor" opacity="0.35" strokeWidth="3" strokeLinecap="round" />
        </svg>
    );
}

function DashboardSvg() {
    return (
        <svg viewBox="0 0 120 120" fill="none" role="img" aria-label="Dashboard empty illustration">
            <rect x="18" y="26" width="84" height="68" rx="10" stroke="currentColor" opacity="0.25" strokeWidth="2" />
            <path d="M28 42h64" stroke="currentColor" opacity="0.35" strokeWidth="3" strokeLinecap="round" />
            <path d="M28 54h38" stroke="currentColor" opacity="0.35" strokeWidth="3" strokeLinecap="round" />
            <path d="M28 72l14-10 12 8 16-14 22 16" stroke="currentColor" opacity="0.55" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function DocsSvg() {
    return (
        <svg viewBox="0 0 120 120" fill="none" role="img" aria-label="Documents empty illustration">
            <path d="M34 26h34l18 18v50a10 10 0 0 1-10 10H34a10 10 0 0 1-10-10V36a10 10 0 0 1 10-10Z" stroke="currentColor" opacity="0.25" strokeWidth="2" />
            <path d="M68 26v20h20" stroke="currentColor" opacity="0.35" strokeWidth="2" />
            <path d="M34 60h52" stroke="currentColor" opacity="0.45" strokeWidth="3" strokeLinecap="round" />
            <path d="M34 72h42" stroke="currentColor" opacity="0.35" strokeWidth="3" strokeLinecap="round" />
            <path d="M34 84h30" stroke="currentColor" opacity="0.25" strokeWidth="3" strokeLinecap="round" />
        </svg>
    );
}
