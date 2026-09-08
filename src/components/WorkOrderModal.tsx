/**
 * Municipal Work Order Generation & Closed-Loop Lifecycle Modal
 */

import React, { useState } from 'react';
import { RoadEvent } from '../types';
import { apiClient } from '../api/client';

interface WorkOrderModalProps {
  issue: RoadEvent;
  onClose: () => void;
  onStatusUpdated?: (newStatus: string) => void;
}

export function WorkOrderModal({ issue, onClose, onStatusUpdated }: WorkOrderModalProps) {
  const [department, setDepartment] = useState('BBMP Road Infrastructure Division');
  const [contractor, setContractor] = useState('Rapid Asphalt Response Unit 4');
  const [notes, setNotes] = useState('Priority road restoration required within 24 hours.');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleDownloadPdf = async () => {
    setIsGenerating(true);
    setStatusMessage(null);
    try {
      await apiClient.downloadWorkOrderPdf(issue.id, department);
      setStatusMessage('Official Work Order PDF generated and downloaded successfully.');
    } catch (err: any) {
      setStatusMessage(`Generation failed: ${err.message || err}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAdvanceStatus = async (targetStatus: string) => {
    setIsAdvancing(true);
    setStatusMessage(null);
    try {
      await apiClient.updateLifecycle(issue.id, targetStatus, department, notes);
      setStatusMessage(`Status transitioned to ${targetStatus}`);
      if (onStatusUpdated) onStatusUpdated(targetStatus);
    } catch (err: any) {
      setStatusMessage(`Status transition failed: ${err.message || err}`);
    } finally {
      setIsAdvancing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-xl w-full p-6 shadow-2xl space-y-5 text-gray-100 animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <i className="fa-solid fa-file-invoice text-lg"></i>
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Generate Municipal Work Order</h2>
              <p className="text-xs text-gray-400">Official Municipal Dispatch • BEL × BBMP</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-gray-800 transition"
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        {/* Issue summary badge */}
        <div className="grid grid-cols-3 gap-3 p-3 bg-gray-950/70 border border-gray-800 rounded-lg text-xs">
          <div>
            <span className="text-gray-500 block text-[10px] uppercase">Issue ID</span>
            <span className="font-mono text-blue-400 font-bold">{issue.id}</span>
          </div>
          <div>
            <span className="text-gray-500 block text-[10px] uppercase">Category / Severity</span>
            <span className="font-semibold text-white">{issue.type.toUpperCase()} • Severity {issue.severity}/10</span>
          </div>
          <div>
            <span className="text-gray-500 block text-[10px] uppercase">Multi-Pass Consensus</span>
            <span className="font-semibold text-green-400">{Math.round(((issue.observations?.[0]?.confidence ?? 0.85) * 100))}% ({issue.observations?.length ?? 1} passes)</span>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-gray-400 mb-1 font-medium">Assigned Municipal Authority</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-md p-2 text-white focus:outline-hidden focus:border-blue-500"
            >
              <option value="BBMP Road Infrastructure Division">BBMP Road Infrastructure Division</option>
              <option value="BBMP Stormwater Drain Maintenance">BBMP Stormwater Drain Maintenance</option>
              <option value="BTP Traffic Calming & Engineering Cell">BTP Traffic Calming & Engineering Cell</option>
              <option value="NHAI Bengaluru Suburban Section">NHAI Bengaluru Suburban Section</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-400 mb-1 font-medium">Designated Field Contractor</label>
            <input
              type="text"
              value={contractor}
              onChange={(e) => setContractor(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-md p-2 text-white focus:outline-hidden focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-gray-400 mb-1 font-medium">Operational Instructions / SLA</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-md p-2 text-white focus:outline-hidden focus:border-blue-500 resize-none"
            />
          </div>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div className="p-2.5 bg-blue-950/40 border border-blue-800/60 rounded text-xs text-blue-300 flex items-center gap-2">
            <i className="fa-solid fa-circle-info text-blue-400"></i>
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Closed-Loop Maintenance State Transitions */}
        <div className="pt-2 border-t border-gray-800">
          <span className="text-[11px] text-gray-400 block mb-2 font-medium">Closed-Loop Maintenance Lifecycle:</span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleAdvanceStatus('IN_PROGRESS')}
              disabled={isAdvancing}
              className="px-3 py-1.5 rounded bg-yellow-600/20 text-yellow-400 border border-yellow-600/40 hover:bg-yellow-600/30 text-xs font-medium transition"
            >
              <i className="fa-solid fa-person-digging mr-1"></i> Mark Dispatched (IN_PROGRESS)
            </button>
            <button
              onClick={() => handleAdvanceStatus('REPAIRED')}
              disabled={isAdvancing}
              className="px-3 py-1.5 rounded bg-emerald-600/20 text-emerald-400 border border-emerald-600/40 hover:bg-emerald-600/30 text-xs font-medium transition"
            >
              <i className="fa-solid fa-circle-check mr-1"></i> Mark Field Repaired
            </button>
            <button
              onClick={() => handleAdvanceStatus('RESOLUTION_VERIFIED')}
              disabled={isAdvancing}
              className="px-3 py-1.5 rounded bg-cyan-600/20 text-cyan-400 border border-cyan-600/40 hover:bg-cyan-600/30 text-xs font-medium transition"
            >
              <i className="fa-solid fa-shield-check mr-1"></i> Certify Resolution Verified
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-medium text-gray-300 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={isGenerating}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-semibold text-white shadow-md flex items-center gap-2 transition disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <i className="fa-solid fa-spinner animate-spin"></i>
                Generating PDF...
              </>
            ) : (
              <>
                <i className="fa-solid fa-download"></i>
                Download Official PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
