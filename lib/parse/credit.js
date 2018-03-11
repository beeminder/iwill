import _ from 'lodash'

import { timeDiff } from './time'
import computeCredit from '../latepenalty'

export default function parseCredit({ dueDate, finishDate }) {
  if (!dueDate && finishDate) { // completed without a due date
    return 1
  } else if (!dueDate || (!finishDate && Date.now() < dueDate)) { // incomplete
    return null
  }

  return computeCredit(timeDiff({ dueDate, finishDate }))
}

export const calculateReliability = (promises) =>
  _(promises)
    .map((p) => p.credit)
    .compact()
    .mean()
