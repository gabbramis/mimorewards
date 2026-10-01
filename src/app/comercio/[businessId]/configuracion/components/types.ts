export type ConfigFormState = {
    name: string;
    slug: string;
    logo_url: string;
    reward_target: number;
    reward_description: string;
    primary_color: string;
    welcome_stamp?: boolean;
    stamps_expiration?: string;
    strict_schedule_enabled?: boolean;
    cooldown_hours?: number;
    operating_hours?: DayHourState[];
    alert_phone?: string;
    notify_redemptions?: boolean;
    notify_weekly_summary?: boolean;
    notify_fraud_anomaly?: boolean;
    notify_first_visit?: boolean;
};

export type LocalConfigFormState = {
    notification_phone: string;
    alert_on_completion: boolean;
    weekly_summary: boolean;
    nfc_protection: boolean;
};

export type DayHourState = {
    day: string;
    isOpen: boolean;
    openTime: string;
    closeTime: string;
};
