import unittest

import numpy as np

from train import combine_prediction, fit_woods_curve, woods_predict


class WoodCurveTests(unittest.TestCase):
    def test_recovers_known_curve(self):
        days = np.array([5, 20, 45, 80, 120, 180, 250], dtype=float)
        expected = (2.4, 0.24, 0.006)
        yields = woods_predict(days, *expected)
        fitted = fit_woods_curve(days, yields)
        np.testing.assert_allclose(fitted, expected, rtol=1e-3)

    def test_rejects_too_few_observations(self):
        with self.assertRaises(ValueError):
            fit_woods_curve([10, 20, 30, 40], [2, 3, 4, 3])

    def test_rejects_non_positive_days(self):
        with self.assertRaises(ValueError):
            woods_predict([0, 10], 2.4, 0.24, 0.006)

    def test_combined_prediction_is_clipped_to_safe_bounds(self):
        prediction = combine_prediction([1.0, 8.0], [-4.0, 5.0], clip_high=10.0)
        np.testing.assert_allclose(prediction, [0.0, 10.0])


if __name__ == "__main__":
    unittest.main()
