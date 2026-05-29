// @ts-nocheck
// frontend/pages/solutions/[slug].tsx
// Dynamic route — renders SolutionPage template with the right config

import { GetStaticProps, GetStaticPaths } from 'next'
import SolutionPage from '../../components/solutions/SolutionPage'
import { SOLUTIONS, SOLUTION_MAP } from '../../lib/solutions'

export default function SolutionRoute({ solution }) {
  return <SolutionPage solution={solution}/>
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: SOLUTIONS.map(s => ({ params: { slug: s.slug } })),
  fallback: false,
})

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const solution = SOLUTION_MAP[params?.slug as string] ?? null
  if (!solution) return { notFound: true }
  return { props: { solution } }
}
