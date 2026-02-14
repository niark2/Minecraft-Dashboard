'use client';

import { usePathname } from 'next/navigation';

export default function LayoutContent({
    children,
    topBar
}: {
    children: React.ReactNode,
    topBar: React.ReactNode
}) {
    const pathname = usePathname();

    // Pages où la TopBar ne doit PAS s'afficher
    const hideTopBarRoutes = ['/login', '/register'];
    const shouldHideTopBar = hideTopBarRoutes.includes(pathname);

    return (
        <>
            {!shouldHideTopBar && topBar}
            {children}
        </>
    );
}
