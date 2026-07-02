'use client';
import { use } from 'react';
import MemberProfileView from '../../../../client/poimen/views/MemberProfileView.jsx';

export default function MemberPage({ params }) {
  const { id } = use(params);
  return <MemberProfileView memberId={parseInt(id)} />;
}
