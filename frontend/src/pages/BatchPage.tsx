/**
 * F3: 数据集批量打标 / Dataset Batch Tagging.
 *
 * Top-level page that switches between the dataset list view and a dataset's
 * detail view based on the `:datasetName` route param.
 * / 顶层页面，根据路由参数 :datasetName 在数据集列表视图与数据集详情视图之间切换。
 */

import React from 'react'
import { useParams } from 'react-router-dom'
import DatasetListView from './DatasetListView'
import DatasetDetailView from './DatasetDetailView'

const BatchPage: React.FC = () => {
  const { datasetName } = useParams<{ datasetName?: string }>()

  if (datasetName) {
    return <DatasetDetailView datasetName={datasetName} />
  }
  return <DatasetListView />
}

export default BatchPage
