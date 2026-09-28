export type ConfigFormState = {
    name: string;
    slug: string;
    logo_url: string;
    reward_target: number;
    reward_description: string;
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
