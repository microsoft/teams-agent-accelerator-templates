"""
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the MIT License.
"""

from pydantic import BaseModel


class RequiredField(BaseModel):
    field_name: str
    field_description: str


class TaskConfig(BaseModel):
    task_name: str
    required_fields: list[RequiredField]


os_field = RequiredField(
    field_name="OS",
    field_description="The operating system of the device (e.g. Windows, macOS, Linux, etc.). Also which specific version of the OS.",  # noqa: E501
)
device_type_field = RequiredField(
    field_name="Device Type",
    field_description="The type of device (e.g. laptop, desktop, tablet, etc.)",
)
year_field = RequiredField(
    field_name="Year", field_description="The year of the device"
)


tasks_by_config = {
    "troubleshoot_device_issue": TaskConfig(
        task_name="troubleshoot_device_issue",
        required_fields=[os_field, device_type_field, year_field],
    ),
    "troubleshoot_connectivity_issue": TaskConfig(
        task_name="troubleshoot_connectivity_issue",
        required_fields=[os_field, device_type_field],
    ),
    "troubleshoot_access_issue": TaskConfig(
        task_name="troubleshoot_access_issue",
        required_fields=[os_field, device_type_field, year_field],
    ),
}
