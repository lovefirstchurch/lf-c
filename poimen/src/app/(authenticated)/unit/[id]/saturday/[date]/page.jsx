'use client';
import { use } from 'react';
import UnitSaturdayView from '../../../../../../client/poimen/views/UnitSaturdayView.jsx';

export default function UnitSaturdayPage({ params }) {
  const { id, date } = use(params);
  return <UnitSaturdayView unitId={parseInt(id)} date={date} />;
}
