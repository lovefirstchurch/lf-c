'use client';
import { use } from 'react';
import AreaView from '../../../../client/poimen/views/AreaView.jsx';

export default function AreaPage({ params }) {
  const { id } = use(params);
  return <AreaView areaId={parseInt(id)} />;
}
