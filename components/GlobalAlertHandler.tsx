import React from 'react';
import { useUiStore, dismissGlobalAlert } from '@/lib/ui_store';
import OutOfRangeModal from './OutOfRangeModal';
import MakiModal from './MakiModal';

/**
 * 🌍 GLOBAL ALERT HANDLER
 * Listens to UiStore and renders professional modals based on system state.
 */
export default function GlobalAlertHandler() {
    const { globalServiceAlert, selectedBranch } = useUiStore();

    if (!globalServiceAlert) return null;

    const { visible, title, message, type, onConfirm } = globalServiceAlert;

    const handleConfirm = () => {
        dismissGlobalAlert();
        if (onConfirm) {
            onConfirm();
        }
    };

    if (type === 'out_of_range') {
        return (
            <OutOfRangeModal
                visible={visible}
                onAcknowledge={handleConfirm}
                branchName={selectedBranch?.name}
                message={message}
            />
        );
    }

    // Default to MakiModal for other types
    return (
        <MakiModal
            visible={visible}
            type={type === 'stock_limit' ? 'warning' : 'warning'}
            title={title}
            message={message}
            onConfirm={handleConfirm}
            confirmText="OK"
        />
    );
}
