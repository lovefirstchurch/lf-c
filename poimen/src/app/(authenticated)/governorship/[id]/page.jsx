'use client';
import { use } from 'react';
import GovernorshipView from '../../../../client/poimen/views/GovernorshipView.jsx';

export default function GovernorshipPage({ params }) {
  const { id } = use(params);
  return <GovernorshipView govId={parseInt(id)} />;
}
