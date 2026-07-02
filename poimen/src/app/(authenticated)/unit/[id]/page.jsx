'use client';
import { use } from 'react';
import UnitView from '../../../../client/poimen/views/UnitView.jsx';

export default function UnitPage({ params }) {
  const { id } = use(params);
  return <UnitView unitId={parseInt(id)} />;
}
