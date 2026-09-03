"""Модели выгрузки УдГУ — единый язык между шаблоном и пайплайном.

Почему так: Pydantic даёт строгую валидацию (TRL 1-9, competencies как list[str])
и генерирует JSON-схему для Excel-шаблона. Импорт без БД — модели чистые.
Расширяемость через extra_sections позволяет добавлять 08_... без ломки схемы.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class University(BaseModel):
    """Метаданные университета — заголовок выгрузки."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., description="Полное наименование университета")
    short_name: str | None = Field(default=None, description="Краткое наименование")
    region: str | None = Field(default=None, description="Регион")
    description: str | None = Field(default=None, description="Краткое описание")


class Department(BaseModel):
    """Кафедра / лаборатория (01_кафедры_лаб)."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., description="Название кафедры/лаборатории")
    faculty: str | None = Field(default=None, description="Факультет/институт")
    head: str | None = Field(default=None, description="Руководитель")
    description: str | None = Field(default=None, description="Описание")
    competencies: list[str] = Field(
        default_factory=list, description="Компетенции как в платформе (list[str])"
    )
    raw_refs: list[str] = Field(default_factory=list, description="Ссылки на сырые файлы")


class Priority(BaseModel):
    """Приоритет / научный задел (02_приоритеты_заделы)."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(..., description="Направление / приоритет")
    description: str | None = Field(default=None, description="Описание задела")
    trl: int | None = Field(
        default=None, ge=1, le=9, description="Уровень готовности TRL 1-9"
    )
    competencies: list[str] = Field(
        default_factory=list, description="Компетенции как в платформе"
    )
    publications: list[str] = Field(default_factory=list, description="Публикации/патенты-ссылки")
    collaborations: list[str] = Field(default_factory=list, description="Коллаборации")
    raw_refs: list[str] = Field(default_factory=list, description="Ссылки на сырые файлы")


class Mission(BaseModel):
    """Миссия и фронтир университета (03_миссия_фронтир)."""

    model_config = ConfigDict(extra="forbid")

    mission_text: str | None = Field(default=None, description="Текст миссии")
    frontier: list[str] = Field(default_factory=list, description="Фронтир 3-5 направлений")
    strategy_until: int | None = Field(
        default=None, ge=2000, le=2100, description="Горизонт стратегии (год)"
    )
    document_links: list[str] = Field(default_factory=list, description="Ссылки на документы")


class Equipment(BaseModel):
    """Оборудование (04_оборудование)."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., description="Название оборудования")
    model: str | None = Field(default=None, description="Модель")
    year: int | None = Field(default=None, ge=1900, le=2100, description="Год выпуска")
    characteristics: str | None = Field(default=None, description="Характеристики")
    available_for_sme: bool = Field(default=False, description="Доступно для МСП")
    access_conditions: str | None = Field(default=None, description="Условия доступа")
    contact: str | None = Field(default=None, description="Контакт")
    competencies: list[str] = Field(
        default_factory=list, description="Компетенции как в платформе"
    )
    raw_refs: list[str] = Field(default_factory=list, description="Фото/паспорт как файл")


class Patent(BaseModel):
    """РИД: патент / публикация / ПО (05_РИД)."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(..., description="Название РИД")
    kind: str | None = Field(default=None, description="Тип: патент, публикация, ПО")
    number: str | None = Field(default=None, description="Номер")
    date: str | None = Field(default=None, description="Дата (ISO или год)")
    authors: list[str] = Field(default_factory=list, description="Авторы")
    status: str | None = Field(default=None, description="Статус")
    link: str | None = Field(default=None, description="Ссылка/файл")
    competencies: list[str] = Field(
        default_factory=list, description="Компетенции как в платформе"
    )
    raw_refs: list[str] = Field(default_factory=list, description="Ссылки на сырые файлы")


class Service(BaseModel):
    """Услуга для МСП (06_услуги_МСП)."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., description="Название услуги")
    description: str | None = Field(default=None, description="Описание")
    format: str | None = Field(default=None, description="Формат: консалт/испытания/НИОКР")
    competencies: list[str] = Field(
        default_factory=list, description="Компетенция как в платформе"
    )
    terms: str | None = Field(default=None, description="Сроки")
    price_order: str | None = Field(default=None, description="Порядок цены")
    cases: list[str] = Field(default_factory=list, description="Кейсы")
    contact: str | None = Field(default=None, description="Контакт")
    raw_refs: list[str] = Field(default_factory=list, description="Ссылки на сырые файлы")


class Person(BaseModel):
    """Эксперт / человек (07_люди_эксперты)."""

    model_config = ConfigDict(extra="forbid")

    full_name: str = Field(..., description="ФИО")
    position: str | None = Field(default=None, description="Должность")
    department: str | None = Field(default=None, description="Кафедра/лаборатория")
    competencies: list[str] = Field(
        default_factory=list, description="Компетенции как в платформе"
    )
    contacts: str | None = Field(default=None, description="Контакты")
    raw_refs: list[str] = Field(default_factory=list, description="Ссылки на сырые файлы")


class RawRef(BaseModel):
    """Ссылка на сырой файл (папка raw/ или тематическая папка)."""

    model_config = ConfigDict(extra="forbid")

    file: str = Field(..., description="Путь к файлу внутри архива")
    entity_type: str | None = Field(default=None, description="Тип сущности")
    entity_id: str | None = Field(default=None, description="Идентификатор сущности")
    description: str | None = Field(default=None, description="Описание")


class UdguImport(BaseModel):
    """Корневая модель импорта УдГУ — 7 разделов + raw_refs + university + расширяемость.

    Почему extra_sections: позволяет добавлять 08_... без изменения кода
    (требование R24 — примеры не исчерпывающие). Дополнительные свойства
    верхнего уровня также разрешены для совместимости с additionalProperties.
    """

    model_config = ConfigDict(extra="allow")

    university: University = Field(..., description="Метаданные университета")
    departments: list[Department] = Field(default_factory=list, description="01_кафедры_лаб")
    priorities: list[Priority] = Field(default_factory=list, description="02_приоритеты_заделы")
    mission: Mission | None = Field(default=None, description="03_миссия_фронтир")
    equipment: list[Equipment] = Field(default_factory=list, description="04_оборудование")
    patents: list[Patent] = Field(default_factory=list, description="05_РИД")
    services: list[Service] = Field(default_factory=list, description="06_услуги_МСП")
    people: list[Person] = Field(default_factory=list, description="07_люди_эксперты")
    raw_refs: list[RawRef] = Field(default_factory=list, description="Индекс сырых файлов")
    extra_sections: dict[str, list[dict[str, Any]]] = Field(
        default_factory=dict,
        description="Расширяемые секции 08_...: имя -> список записей",
    )
