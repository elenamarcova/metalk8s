from importlib import reload
import os.path
from unittest import TestCase
from unittest.mock import MagicMock, patch

from kubernetes.client.rest import ApiException
from parameterized import param, parameterized
from salt.utils import dictupdate, hashutils
from salt.exceptions import CommandExecutionError
import yaml

import metalk8s_kubernetes

from tests.unit import mixins
from tests.unit import utils


YAML_TESTS_FILE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "files", "test_metalk8s_kubernetes.yaml"
)
with open(YAML_TESTS_FILE) as fd:
    YAML_TESTS_CASES = yaml.safe_load(fd)


class Metalk8sKubernetesTestCase(TestCase, mixins.LoaderModuleMockMixin):
    """
    TestCase for `metalk8s_kubernetes` module
    """

    loader_module = metalk8s_kubernetes

    @staticmethod
    def loader_module_globals():
        def _manifest_to_object_mock(manifest, **_):
            # Simulate k8s object for key used in the module
            # It's not really robust but here we only test the
            # `metalk8s_kubernetes` module
            obj = MagicMock()

            obj.api_version = manifest.get("apiVersion")
            obj.kind = manifest.get("kind")

            meta = manifest.get("metadata", {})
            obj.metadata.name = meta.get("name")
            obj.metadata.namespace = meta.get("namespace")
            obj.metadata.resourceVersion = meta.get("resourceVersion")
            obj.metadata.resource_version = meta.get("resource_version")

            obj.spec.cluster_ip = manifest.get("spec", {}).get("clusterIP")
            obj.spec.health_check_node_port = manifest.get("spec", {}).get(
                "healthCheckNodePort"
            )
            obj.spec.type = manifest.get("spec", {}).get("type")

            def _to_dict():
                if obj.metadata.resourceVersion:
                    meta["resourceVersion"] = obj.metadata.resourceVersion
                if obj.metadata.resource_version:
                    meta["resourceVersion"] = obj.metadata.resource_version
                if obj.spec.cluster_ip:
                    manifest.setdefault("spec", {})["clusterIP"] = obj.spec.cluster_ip
                    if "cluster_ip" in manifest.get("spec", {}):
                        del manifest["spec"]["cluster_ip"]
                if obj.spec.type:
                    manifest.setdefault("spec", {})["type"] = obj.spec.type
                if obj.spec.health_check_node_port:
                    manifest.setdefault("spec", {})[
                        "healthCheckNodePort"
                    ] = obj.spec.health_check_node_port
                    if "health_check_node_port" in manifest.get("spec", {}):
                        del manifest["spec"]["health_check_node_port"]

                return manifest

            obj.to_dict.side_effect = _to_dict

            return obj

        salt_dict = {
            "metalk8s_kubernetes.get_kubeconfig": MagicMock(
                return_value=("/my/kube/config", "my-context")
            )
        }

        # We need an object for `__salt__` since in `metalk8s_kubernetes`
        # we use attribute to call `format_slots` function
        salt_obj = MagicMock()

        salt_obj.__getitem__.side_effect = salt_dict.__getitem__
        salt_obj.__setitem__.side_effect = salt_dict.__setitem__
        salt_obj.__iter__.side_effect = salt_dict.__iter__
        salt_obj.copy.side_effect = salt_dict.copy
        salt_obj.update.side_effect = salt_dict.update
        salt_obj.clear.side_effect = salt_dict.clear

        def _hashutil_digest(instr, checksum="md5"):
            if checksum == "sha256":
                return hashutils.sha256_digest(instr)
            elif checksum == "md5":
                return hashutils.md5_digest(instr)
            raise CommandExecutionError("Invalid hash func {}".format(checksum))

        salt_obj.hashutil.digest.side_effect = _hashutil_digest
        # Consider we have no slots in these tests
        salt_obj.metalk8s.format_slots.side_effect = lambda manifest: manifest

        return {
            "__utils__": {
                "metalk8s_kubernetes.get_kind_info": MagicMock(),
                "metalk8s_kubernetes.convert_manifest_to_object": MagicMock(
                    side_effect=_manifest_to_object_mock
                ),
            },
            "__salt__": salt_obj,
        }

    def assertDictContainsSubset(self, subdict, maindict):
        return self.assertEqual(dict(maindict, **subdict), maindict)

    def test_virtual_success(self):
        """
        Tests the return of `__virtual__` function, success
        """
        reload(metalk8s_kubernetes)
        self.assertEqual(metalk8s_kubernetes.__virtual__(), "metalk8s_kubernetes")

    @parameterized.expand(["kubernetes.client", ("urllib3.exceptions", "urllib3")])
    def test_virtual_fail_import(self, import_error_on, dep_error=None):
        """
        Tests the return of `__virtual__` function, fail import
        """
        with utils.ForceImportErrorOn(import_error_on):
            reload(metalk8s_kubernetes)
            self.assertEqual(
                metalk8s_kubernetes.__virtual__(),
                (
                    False,
                    "Missing dependencies: {}".format(dep_error or import_error_on),
                ),
            )

    def test_virtual_no_utils(self):
        """
        Tests the return of `__virtual__` function, missing kubernetes utils
        """
        with patch.dict(metalk8s_kubernetes.__utils__):
            metalk8s_kubernetes.__utils__.pop("metalk8s_kubernetes.get_kind_info")
            reload(metalk8s_kubernetes)
            self.assertEqual(
                metalk8s_kubernetes.__virtual__(),
                (False, "Missing `metalk8s_kubernetes` utils module"),
            )

    @utils.parameterized_from_cases(
        YAML_TESTS_CASES["create_object"] + YAML_TESTS_CASES["common_tests"]
    )
    def test_create_object(
        self,
        result,
        raises=False,
        api_status_code=None,
        info_scope="cluster",
        manifest_file_content=None,
        called_with=None,
        **kwargs
    ):
        """
        Tests the return of `create_object` function
        """

        def _create_mock(body, **_):
            if api_status_code is not None:
                raise ApiException(
                    status=api_status_code, reason="An error has occurred"
                )

            # body == object
            return body

        get_kind_info_mock = MagicMock()
        if not info_scope:
            get_kind_info_mock.side_effect = ValueError("An error has occurred")
        get_kind_info_mock.return_value.scope = info_scope

        create_mock = get_kind_info_mock.return_value.client.create
        create_mock.side_effect = _create_mock

        manifest_read_mock = MagicMock()
        # None = IOError
        # False = YAMLError
        if manifest_file_content is None:
            manifest_read_mock.side_effect = IOError("An error has occurred")
        elif manifest_file_content is False:
            manifest_read_mock.side_effect = yaml.YAMLError("An error has occurred")
        else:
            manifest_read_mock.return_value = manifest_file_content

        utils_dict = {"metalk8s_kubernetes.get_kind_info": get_kind_info_mock}
        salt_dict = {
            "metalk8s_kubernetes.read_and_render_yaml_file": manifest_read_mock
        }
        with patch.dict(metalk8s_kubernetes.__utils__, utils_dict), patch.dict(
            metalk8s_kubernetes.__salt__, salt_dict
        ):
            if raises:
                self.assertRaisesRegex(
                    Exception, result, metalk8s_kubernetes.create_object, **kwargs
                )
            else:
                self.assertEqual(metalk8s_kubernetes.create_object(**kwargs), result)
                create_mock.assert_called_once()
                if called_with:
                    self.assertDictContainsSubset(called_with, create_mock.call_args[1])

    @utils.parameterized_from_cases(
        YAML_TESTS_CASES["delete_object"] + YAML_TESTS_CASES["common_tests"]
    )
    def test_delete_object(
        self,
        result,
        raises=False,
        api_status_code=None,
        info_scope="namespaced",
        manifest_file_content=None,
        called_with=None,
        **kwargs
    ):
        """
        Tests the return of `delete_object` function
        """

        def _delete_mock(name, **_):
            if api_status_code is not None:
                raise ApiException(
                    status=api_status_code, reason="An error has occurred"
                )

            res = MagicMock()
            # Do not return a real object as it does not bring any value in
            # this test
            res.to_dict.return_value = "<{} deleted object dict>".format(name)
            return res

        get_kind_info_mock = MagicMock()
        if not info_scope:
            get_kind_info_mock.side_effect = ValueError("An error has occurred")
        get_kind_info_mock.return_value.scope = info_scope

        delete_mock = get_kind_info_mock.return_value.client.delete
        delete_mock.side_effect = _delete_mock

        manifest_read_mock = MagicMock()
        # None = IOError
        # False = YAMLError
        if manifest_file_content is None:
            manifest_read_mock.side_effect = IOError("An error has occurred")
        elif manifest_file_content is False:
            manifest_read_mock.side_effect = yaml.YAMLError("An error has occurred")
        else:
            manifest_read_mock.return_value = manifest_file_content

        utils_dict = {"metalk8s_kubernetes.get_kind_info": get_kind_info_mock}
        salt_dict = {
            "metalk8s_kubernetes.read_and_render_yaml_file": manifest_read_mock
        }
        with patch.dict(metalk8s_kubernetes.__utils__, utils_dict), patch.dict(
            metalk8s_kubernetes.__salt__, salt_dict
        ):
            if raises:
                self.assertRaisesRegex(
                    Exception, result, metalk8s_kubernetes.delete_object, **kwargs
                )
            else:
                self.assertEqual(metalk8s_kubernetes.delete_object(**kwargs), result)
                delete_mock.assert_called_once()
                if called_with:
                    self.assertDictContainsSubset(called_with, delete_mock.call_args[1])

    @utils.parameterized_from_cases(
        YAML_TESTS_CASES["replace_object"] + YAML_TESTS_CASES["common_tests"]
    )
    def test_replace_object(
        self,
        result,
        raises=False,
        api_status_code=None,
        info_scope="cluster",
        manifest_file_content=None,
        called_with=None,
        **kwargs
    ):
        """
        Tests the return of `repace_object` function
        """

        def _replace_mock(body, **_):
            if api_status_code is not None:
                raise ApiException(
                    status=api_status_code, reason="An error has occurred"
                )

            # body == object
            return body

        get_kind_info_mock = MagicMock()
        if not info_scope:
            get_kind_info_mock.side_effect = ValueError("An error has occurred")
        get_kind_info_mock.return_value.scope = info_scope

        replace_mock = get_kind_info_mock.return_value.client.replace
        replace_mock.side_effect = _replace_mock

        manifest_read_mock = MagicMock()
        # None = IOError
        # False = YAMLError
        if manifest_file_content is None:
            manifest_read_mock.side_effect = IOError("An error has occurred")
        elif manifest_file_content is False:
            manifest_read_mock.side_effect = yaml.YAMLError("An error has occurred")
        else:
            manifest_read_mock.return_value = manifest_file_content

        utils_dict = {"metalk8s_kubernetes.get_kind_info": get_kind_info_mock}
        salt_dict = {
            "metalk8s_kubernetes.read_and_render_yaml_file": manifest_read_mock
        }
        with patch.dict(metalk8s_kubernetes.__utils__, utils_dict), patch.dict(
            metalk8s_kubernetes.__salt__, salt_dict
        ):
            if raises:
                self.assertRaisesRegex(
                    Exception, result, metalk8s_kubernetes.replace_object, **kwargs
                )
            else:
                self.assertEqual(metalk8s_kubernetes.replace_object(**kwargs), result)
                replace_mock.assert_called_once()
                if called_with:
                    self.assertDictContainsSubset(
                        called_with, replace_mock.call_args[1]
                    )

    @utils.parameterized_from_cases(
        YAML_TESTS_CASES["get_object"] + YAML_TESTS_CASES["common_tests"]
    )
    def test_get_object(
        self,
        result,
        raises=False,
        api_status_code=None,
        info_scope="namespaced",
        manifest_file_content=None,
        called_with=None,
        **kwargs
    ):
        """
        Tests the return of `get_object` function
        """

        def _retrieve_mock(name, **_):
            if api_status_code is not None:
                raise ApiException(
                    status=api_status_code, reason="An error has occurred"
                )

            res = MagicMock()
            # Do not return a real object as it does not bring any value in
            # this test
            res.to_dict.return_value = "<{} object dict>".format(name)
            return res

        get_kind_info_mock = MagicMock()
        if not info_scope:
            get_kind_info_mock.side_effect = ValueError("An error has occurred")
        get_kind_info_mock.return_value.scope = info_scope

        retrieve_mock = get_kind_info_mock.return_value.client.retrieve
        retrieve_mock.side_effect = _retrieve_mock

        manifest_read_mock = MagicMock()
        # None = IOError
        # False = YAMLError
        if manifest_file_content is None:
            manifest_read_mock.side_effect = IOError("An error has occurred")
        elif manifest_file_content is False:
            manifest_read_mock.side_effect = yaml.YAMLError("An error has occurred")
        else:
            manifest_read_mock.return_value = manifest_file_content

        utils_dict = {"metalk8s_kubernetes.get_kind_info": get_kind_info_mock}
        salt_dict = {
            "metalk8s_kubernetes.read_and_render_yaml_file": manifest_read_mock
        }
        with patch.dict(metalk8s_kubernetes.__utils__, utils_dict), patch.dict(
            metalk8s_kubernetes.__salt__, salt_dict
        ):
            if raises:
                self.assertRaisesRegex(
                    Exception, result, metalk8s_kubernetes.get_object, **kwargs
                )
            else:
                self.assertEqual(metalk8s_kubernetes.get_object(**kwargs), result)
                retrieve_mock.assert_called_once()
                if called_with:
                    self.assertDictContainsSubset(
                        called_with, retrieve_mock.call_args[1]
                    )

    @utils.parameterized_from_cases(
        YAML_TESTS_CASES["update_object"] + YAML_TESTS_CASES["common_tests"]
    )
    def test_update_object(
        self,
        result,
        raises=False,
        initial_obj=None,
        info_scope="cluster",
        manifest_file_content=None,
        called_with=None,
        **kwargs
    ):
        """
        Tests the return of `update_object` function
        """

        def _update_mock(body, **_):
            if not initial_obj:
                raise ApiException(status=0, reason="An error has occurred")

            res = MagicMock()
            # body == patch
            res.to_dict.return_value = dictupdate.update(initial_obj, body)
            return res

        get_kind_info_mock = MagicMock()
        if not info_scope:
            get_kind_info_mock.side_effect = ValueError("An error has occurred")
        get_kind_info_mock.return_value.scope = info_scope

        update_mock = get_kind_info_mock.return_value.client.update
        update_mock.side_effect = _update_mock

        manifest_read_mock = MagicMock()
        # None = IOError
        # False = YAMLError
        if manifest_file_content is None:
            manifest_read_mock.side_effect = IOError("An error has occurred")
        elif manifest_file_content is False:
            manifest_read_mock.side_effect = yaml.YAMLError("An error has occurred")
        else:
            manifest_read_mock.return_value = manifest_file_content

        utils_dict = {"metalk8s_kubernetes.get_kind_info": get_kind_info_mock}
        salt_dict = {
            "metalk8s_kubernetes.read_and_render_yaml_file": manifest_read_mock
        }
        with patch.dict(metalk8s_kubernetes.__utils__, utils_dict), patch.dict(
            metalk8s_kubernetes.__salt__, salt_dict
        ):
            if raises:
                self.assertRaisesRegex(
                    Exception, result, metalk8s_kubernetes.update_object, **kwargs
                )
            else:
                self.assertEqual(metalk8s_kubernetes.update_object(**kwargs), result)
                update_mock.assert_called_once()
                if called_with:
                    self.assertDictContainsSubset(called_with, update_mock.call_args[1])

    @parameterized.expand(
        [
            (
                {"kind": "Pod", "apiVersion": "v1", "metadata": {"name": "my_node"}},
                True,
            ),
            (None, False),
        ]
    )
    def test_object_exists(self, get_object_return, result):
        """
        Tests the return of `object_exists` function
        """
        get_object_mock = MagicMock(return_value=get_object_return)
        # Mock `get_object` as we do not want to test this function again here
        with patch("metalk8s_kubernetes.get_object", get_object_mock):
            self.assertEqual(
                metalk8s_kubernetes.object_exists(
                    kind="Node", apiVersion="v1", name="my_node"
                ),
                result,
            )
            get_object_mock.assert_called_once()

    @utils.parameterized_from_cases(YAML_TESTS_CASES["list_objects"])
    def test_list_objects(
        self,
        result,
        raises=False,
        api_status_code=None,
        info_scope="namespaced",
        called_with=None,
        **kwargs
    ):
        """
        Tests the return of `list_objects` function
        """

        def _list_mock(**_):
            if api_status_code is not None:
                raise ApiException(
                    status=api_status_code, reason="An error has occurred"
                )

            res = MagicMock()
            # Do not return a real list object as it does not bring any value
            # in this test
            obj1 = MagicMock()
            obj1.to_dict.return_value = "<my first object dict>"
            obj2 = MagicMock()
            obj2.to_dict.return_value = "<my second object dict>"

            res.items = [obj1, obj2]
            return res

        get_kind_info_mock = MagicMock()
        if not info_scope:
            get_kind_info_mock.side_effect = ValueError("An error has occurred")
        get_kind_info_mock.return_value.scope = info_scope

        list_mock = get_kind_info_mock.return_value.client.list
        list_mock.side_effect = _list_mock

        utils_dict = {"metalk8s_kubernetes.get_kind_info": get_kind_info_mock}
        with patch.dict(metalk8s_kubernetes.__utils__, utils_dict):
            if raises:
                self.assertRaisesRegex(
                    Exception, result, metalk8s_kubernetes.list_objects, **kwargs
                )
            else:
                self.assertEqual(metalk8s_kubernetes.list_objects(**kwargs), result)
                list_mock.assert_called_once()
                if called_with:
                    self.assertDictContainsSubset(called_with, list_mock.call_args[1])

    @parameterized.expand(
        param.explicit(kwargs=test_case)
        for test_case in YAML_TESTS_CASES["get_object_digest"]
    )
    def test_get_object_digest(self, obj, result, raises=False, **kwargs):
        """
        Tests the return of `get_object_digest` function
        """
        get_obj_mock = MagicMock(return_value=obj)

        with patch("metalk8s_kubernetes.get_object", get_obj_mock):
            if raises:
                self.assertRaisesRegex(
                    Exception, result, metalk8s_kubernetes.get_object_digest, **kwargs
                )
            else:
                self.assertEqual(
                    metalk8s_kubernetes.get_object_digest(**kwargs), result
                )
