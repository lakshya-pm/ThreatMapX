'use client';

import dynamic from 'next/dynamic';

const GlobeComponent = dynamic(() => import('./GlobeComponentImpl'), { ssr: false });

export default function GlobeView(props: any) {
  return <GlobeComponent {...props} />;
}
