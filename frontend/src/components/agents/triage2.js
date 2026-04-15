import React, { useState } from 'react';
import {
  PlusIcon,
  XMarkIcon,
  ArrowUturnLeftIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

import { taskExtraction } from '../../services/workApi';
import { useBullets, AISummarySection } from './AISummarySection';

const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US');
};

function TriageStandalone({
  tasks = [],
  onAddToTasks,
  onDismiss,
  onRevert,
  actionLoading,
}) {
  const [selectedTask, setSelectedTask] = useState(null);

  const {
    bullets,
    bulletsLoading,
    bulletsError,
    fetchBullets,
  } = useBullets({
    taskId: selectedTask?.id,
    aiSummary: selectedTask?.ai_summary,
    describeFn: taskExtraction.describe,
  });

  const handleSelect = (task) => {
    setSelectedTask(task);

    if (!task.ai_summary && !bullets) {
      fetchBullets();
    }
  };

  return (
    <div className="min-h-screen bg-sky-950 text-white px-12 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-3xl font-bold">Incoming</h1>
        <div className="text-sm opacity-70">Account</div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-12 text-sm text-white/70 border-b border-white/10 pb-2 mb-4">
        <div className="col-span-2">DATE</div>
        <div className="col-span-2">SOURCE</div>
        <div className="col-span-2">ACCOUNT</div>
        <div className="col-span-4">TASK</div>
        <div className="col-span-2 text-right">ACTIONS</div>
      </div>

      {/* Task List */}
      <div className="space-y-2 mb-8">
        {tasks.map((task) => {
          const isAdded = task.status === 'added';
          const isSelected = selectedTask?.id === task.id;

          return (
            <div
              key={task.id}
              onClick={() => handleSelect(task)}
              className={`grid grid-cols-12 items-center px-4 py-3 rounded-lg cursor-pointer transition
                ${isSelected ? 'bg-white/10' : 'bg-white/5 hover:bg-white/10'}
              `}
            >
              {/* Date */}
              <div className="col-span-2 text-sm">
                {formatDate(task.source_date)}
              </div>

              {/* Source */}
              <div className="col-span-2 text-xs font-semibold opacity-80">
                {task.source_type || 'Email'}
              </div>

              {/* Account */}
              <div className="col-span-2 text-sm truncate">
                {task.source_account}
              </div>

              {/* Task */}
              <div className="col-span-4 text-sm">
                {task.title}
              </div>

              {/* Actions */}
              <div
                className="col-span-2 flex justify-end gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                {isAdded ? (
                  <>
                    <span className="flex items-center gap-1 text-green-400 text-xs">
                      <CheckCircleIcon className="w-4 h-4" />
                      Added
                    </span>

                    <button
                      onClick={() =>
                        onRevert?.(task.added_todo_id, task.id)
                      }
                      disabled={actionLoading}
                      className="p-1 hover:bg-white/10 rounded"
                    >
                      <ArrowUturnLeftIcon className="w-4 h-4 text-yellow-400" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => onAddToTasks(task)}
                    disabled={actionLoading}
                    className="p-1 hover:bg-white/10 rounded"
                  >
                    <PlusIcon className="w-4 h-4 text-cyan-400" />
                  </button>
                )}

                <button
                  onClick={() => onDismiss(task.id)}
                  disabled={actionLoading}
                  className="p-1 hover:bg-white/10 rounded"
                >
                  <XMarkIcon className="w-4 h-4 text-white/70" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ✅ FULL AI SUMMARY SECTION */}
      {selectedTask && (
        <div className="border-t border-white/10 pt-6">
          <div className="mb-3">
            <h2 className="text-lg font-semibold">
              AI Summary
            </h2>
            <p className="text-sm text-white/50">
              {selectedTask.title}
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <AISummarySection
              taskId={selectedTask.id}
              bullets={bullets}
              loading={bulletsLoading}
              error={bulletsError}
              fetchBullets={fetchBullets}
              showGenerateButton={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(TriageStandalone);