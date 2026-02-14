import { NextRequest, NextResponse } from 'next/server';
import docker from '@/lib/docker';
import { getServerFileContent } from '@/actions/server';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const configContent = await getServerFileContent(id, '/data/server.properties');
        let worldName = 'world';
        const match = configContent.match(/level-name=(.+)/);
        if (match) worldName = match[1].trim();

        const container = docker.getContainer(id);

        // Use docker export-like behavior by getting an archive of the folder
        const stream = await container.getArchive({ path: `/data/${worldName}` });

        return new NextResponse(stream as any, {
            headers: {
                'Content-Type': 'application/x-tar',
                'Content-Disposition': `attachment; filename="${worldName}.tar"`,
            },
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
